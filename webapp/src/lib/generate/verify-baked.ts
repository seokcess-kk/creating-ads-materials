import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";

const TOOL = "record_bake_qa";

/**
 * full 모드(텍스트 베이킹) 결과 검증 — 이미지 모델이 지시를 실제로 따랐는지 확인한다.
 * 프롬프트의 "하드 제약"은 검증 없이는 소망일 뿐이므로, 저비용 비전(haiku) 1콜로
 * 오타·무단 텍스트·로고 유입을 잡는다. QA 인프라 실패는 생성을 막지 않는다(null 반환).
 */
export type BakeIssueCode =
  | "garbled_hangul" // 한글 자모 깨짐·오타·왜곡
  | "unexpected_text" // 지정 문자열 외 텍스트(레퍼런스 잔존 문구 포함)
  | "missing_copy" // 지정 헤드라인/서브가 누락
  | "logo_or_watermark"; // 로고·워터마크·상표 유입

export interface BakeQaResult {
  ok: boolean;
  issues: Array<{ code: BakeIssueCode; detail: string }>;
}

const QaSchema = z.object({
  issues: z.array(z.object({
    code: z.enum(["garbled_hangul", "unexpected_text", "missing_copy", "logo_or_watermark"]),
    detail: z.string().max(200),
  })).max(8),
});

const tool: Tool = {
  name: TOOL,
  description: "생성된 광고 이미지의 텍스트/로고 품질 문제를 기록. 문제 없으면 빈 배열.",
  input_schema: {
    type: "object",
    properties: {
      issues: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            code: {
              type: "string",
              enum: ["garbled_hangul", "unexpected_text", "missing_copy", "logo_or_watermark"],
              description:
                "garbled_hangul=한글 깨짐·오타, unexpected_text=지정 외 텍스트, missing_copy=지정 카피 누락, logo_or_watermark=로고·워터마크 유입",
            },
            detail: { type: "string", description: "무엇이 어디에 보이는지 한 줄(한국어)" },
          },
          required: ["code", "detail"],
        },
      },
    },
    required: ["issues"],
  },
};

type Media = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function verifyBakedImage(
  image: { base64: string; mimeType: string },
  expected: { headline?: string | null; sub?: string | null; extra?: Array<string | null | undefined> },
  usageContext?: UsageContext,
): Promise<BakeQaResult | null> {
  const strings = [
    expected.headline?.trim() ? `헤드라인: "${expected.headline.trim()}"` : null,
    expected.sub?.trim() ? `서브: "${expected.sub.trim()}"` : null,
    ...(expected.extra ?? []).map((t) => (t?.trim() ? `문구: "${t.trim()}"` : null)),
  ].filter(Boolean);
  const expectation = strings.length
    ? `이미지에 렌더되어야 하는 텍스트는 정확히 다음뿐입니다:\n${strings.join("\n")}`
    : "이 이미지는 텍스트가 전혀 없어야 합니다(글자·숫자·워터마크 일체 금지).";
  try {
    const resp = await callClaude({
      model: "haiku",
      maxTokens: 600,
      system:
        "당신은 광고 이미지 QA 검수자입니다. 이미지 속 모든 텍스트를 정확히 읽고 기대 문자열과 대조합니다. 사소한 렌더 스타일 차이는 무시하고, 실제 노출 사고(깨진 한글, 지정 외 문구, 카피 누락, 로고 유입)만 기록하세요. 도구로만 기록.",
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (image.mimeType || "image/png") as Media,
              data: image.base64,
            },
          },
          { type: "text", text: `${expectation}\n\n문제를 ${TOOL} 로 기록하세요(없으면 빈 배열).` },
        ],
      }],
      tools: [tool],
      toolChoice: { type: "tool", name: TOOL },
      usageContext,
    });
    const raw = extractToolUse(resp, TOOL);
    if (!raw) return null;
    const { issues } = QaSchema.parse(raw);
    return { ok: issues.length === 0, issues };
  } catch (e) {
    console.warn("베이킹 QA 실패(검증 생략):", (e as Error).message);
    return null;
  }
}

// ── 인물 동일성 검사 — 레퍼런스 픽셀 참조 생성에서 실존 인물 복제(초상권) 검출 ──
const PERSON_TOOL = "record_person_check";

const PersonSchema = z.object({
  bothHavePerson: z.boolean(),
  samePerson: z.boolean(),
});

const personTool: Tool = {
  name: PERSON_TOOL,
  description: "두 광고 이미지 속 인물이 동일 인물로 보이는지 판정.",
  input_schema: {
    type: "object",
    properties: {
      bothHavePerson: { type: "boolean", description: "두 이미지 모두에 사람 얼굴이 있는가" },
      samePerson: {
        type: "boolean",
        description: "두 이미지의 인물이 같은 사람(동일 얼굴·정체성)으로 보이는가. 한쪽에 사람이 없으면 false.",
      },
    },
    required: ["bothHavePerson", "samePerson"],
  },
};

/**
 * 레퍼런스와 생성물의 인물이 동일 인물인지 검사(haiku 1콜).
 * true = 복제 의심(재생성 필요). QA 인프라 실패는 null(검증 생략 — 생성은 계속).
 */
export async function detectCopiedPerson(
  reference: { base64: string; mimeType: string },
  candidate: { base64: string; mimeType: string },
  usageContext?: UsageContext,
): Promise<boolean | null> {
  try {
    const resp = await callClaude({
      model: "haiku",
      maxTokens: 300,
      system:
        "당신은 광고 이미지 검수자입니다. 첫 번째(레퍼런스)와 두 번째(생성물) 이미지 속 인물이 같은 사람으로 보이는지만 판정하세요. 닮은 정도가 아니라 '동일 인물'로 오인될 수준인지 기준으로. 도구로만 기록.",
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: (reference.mimeType || "image/png") as Media, data: reference.base64 },
          },
          {
            type: "image",
            source: { type: "base64", media_type: (candidate.mimeType || "image/png") as Media, data: candidate.base64 },
          },
          { type: "text", text: `두 이미지의 인물 동일 여부를 ${PERSON_TOOL} 로 기록하세요.` },
        ],
      }],
      tools: [personTool],
      toolChoice: { type: "tool", name: PERSON_TOOL },
      usageContext,
    });
    const raw = extractToolUse(resp, PERSON_TOOL);
    if (!raw) return null;
    const parsed = PersonSchema.parse(raw);
    return parsed.bothHavePerson && parsed.samePerson;
  } catch (e) {
    console.warn("인물 동일성 검사 실패(생략):", (e as Error).message);
    return null;
  }
}

/** 인물 복제 검출 시 재생성 프롬프트에 붙일 교정 지시. */
export const PERSON_CORRECTION =
  "\n\nQUALITY CORRECTION (the previous attempt copied the reference person): The person in the reference must NOT be reproduced. Render a COMPLETELY DIFFERENT individual — different face, bone structure, features and hairstyle — in a similar role and pose.";

/** QA 문제 → 재생성 프롬프트에 붙일 영어 교정 지시. */
export function bakeQaCorrection(issues: BakeQaResult["issues"]): string {
  const notes = issues.map((i) => {
    switch (i.code) {
      case "garbled_hangul":
        return `broken/misspelled Korean text was rendered (${i.detail}) — render every Hangul glyph perfectly, or use fewer, larger words`;
      case "unexpected_text":
        return `extra text appeared (${i.detail}) — remove ALL text except the exact strings specified`;
      case "missing_copy":
        return `required copy was missing (${i.detail}) — render the specified strings prominently`;
      case "logo_or_watermark":
        return `a logo/watermark appeared (${i.detail}) — the image must contain no logos or watermarks`;
    }
  });
  return `\n\nQUALITY CORRECTION (the previous attempt failed QA): ${notes.join("; ")}.`;
}
