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
  expected: { headline?: string | null; sub?: string | null },
  usageContext?: UsageContext,
): Promise<BakeQaResult | null> {
  const strings = [
    expected.headline?.trim() ? `헤드라인: "${expected.headline.trim()}"` : null,
    expected.sub?.trim() ? `서브: "${expected.sub.trim()}"` : null,
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
