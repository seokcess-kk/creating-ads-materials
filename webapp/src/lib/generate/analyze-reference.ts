import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import type { UsageContext } from "@/lib/usage/record";
import type { DesignReference } from "./types";

const TOOL = "record_design_reference";

const fontCategoryProperty = {
  type: "string",
  enum: ["sans", "serif", "rounded", "display", "handwriting"],
  description:
    "가장 가까운 한글 폰트 카테고리: sans, serif, rounded, display, handwriting 중 하나.",
} as const;

const fontFamilyProperty = {
  type: "string",
  enum: [
    "pretendard", "suit", "spoqa-han-sans-neo", "scdream", "gmarket-sans",
    "jalnan-gothic", "jalnan2", "nanum-square-round", "nanum-myeongjo",
    "nanum-barunpen", "cafe24-danjunghae",
  ],
  description:
    "레퍼런스 글자 형태와 가장 가까운 설치 한글 폰트. 본문형 고딕=pretendard/suit/spoqa-han-sans-neo, 기하학·제목=gmarket-sans, 매우 굵고 개성적=jalnan-gothic/jalnan2, 둥근=nanum-square-round, 명조=nanum-myeongjo, 손글씨=nanum-barunpen/cafe24-danjunghae.",
} as const;

const typographyProperty = {
  type: "object",
  description: "레퍼런스 캔버스에서 관찰한 주 카피와 보조 카피의 정규화된 타이포 측정값.",
  properties: {
    alignment: { type: "string", enum: ["left", "center", "right"] },
    headlineSizeRatio: { type: "number", description: "헤드라인 글자 높이 / 이미지 높이 (0~1)" },
    headlineYRatio: { type: "number", description: "첫 헤드라인 baseline Y / 이미지 높이 (0~1)" },
    headlineMaxWidthRatio: { type: "number", description: "헤드라인 텍스트 블록 너비 / 이미지 너비 (0~1)" },
    headlineLineHeight: { type: "number", description: "행간 / 글자 크기 (보통 0.9~1.8)" },
    headlineColor: { type: "string", description: "헤드라인 색상 hex" },
    headlineWeight: { type: "string", enum: ["regular", "medium", "bold", "black"] },
    subSizeRatio: { type: "number", description: "보조문구 글자 높이 / 이미지 높이" },
    subYRatio: { type: "number", description: "보조문구 첫 baseline Y / 이미지 높이" },
    subMaxWidthRatio: { type: "number", description: "보조문구 블록 너비 / 이미지 너비" },
    subColor: { type: "string", description: "보조문구 색상 hex" },
    hasStrokeOrShadow: { type: "boolean" },
  },
  required: [
    "alignment", "headlineSizeRatio", "headlineYRatio", "headlineMaxWidthRatio",
    "headlineLineHeight", "headlineColor", "headlineWeight", "hasStrokeOrShadow",
  ],
} as const;

// 상한은 넉넉히 — 모델 서술이 길어도 파싱 실패하지 않도록(디스크립터는 프롬프트로 주입).
export const DesignReferenceSchema = z.object({
  palette: z.array(z.string().max(40)).max(8),
  mood: z.string().max(200),
  composition: z.string().max(300),
  layout: z.string().max(300),
  typographyVibe: z.string().max(200),
  fontCategory: z
    .enum(["sans", "serif", "rounded", "display", "handwriting"])
    .optional(),
  fontFamily: z.enum([
    "pretendard", "suit", "spoqa-han-sans-neo", "scdream", "gmarket-sans",
    "jalnan-gothic", "jalnan2", "nanum-square-round", "nanum-myeongjo",
    "nanum-barunpen", "cafe24-danjunghae",
  ]).optional(),
  typography: z.object({
    alignment: z.enum(["left", "center", "right"]),
    headlineSizeRatio: z.number().min(0.015).max(0.3),
    headlineYRatio: z.number().min(0).max(1),
    headlineMaxWidthRatio: z.number().min(0.2).max(1),
    headlineLineHeight: z.number().min(0.8).max(2),
    headlineColor: z.string().max(40),
    headlineWeight: z.enum(["regular", "medium", "bold", "black"]),
    subSizeRatio: z.number().min(0.01).max(0.2).optional(),
    subYRatio: z.number().min(0).max(1).optional(),
    subMaxWidthRatio: z.number().min(0.2).max(1).optional(),
    subColor: z.string().max(40).optional(),
    hasStrokeOrShadow: z.boolean().optional(),
  }).optional(),
  notes: z.string().max(400).optional(),
});

const tool: Tool = {
  name: TOOL,
  description:
    "레퍼런스 이미지에서 재현 가능한 '디자인 요소'만 추출. 콘텐츠/문구가 아니라 색·무드·구도·레이아웃·타이포 느낌.",
  input_schema: {
    type: "object",
    properties: {
      palette: {
        type: "array",
        items: { type: "string" },
        description: "주요 색 3~6개. 반드시 hex 코드로(예: #1A2B3C). 색 추출·스킴 판정에 직접 쓰이므로 색 이름 금지.",
      },
      mood: { type: "string", description: "전체 무드/톤 한 줄" },
      composition: { type: "string", description: "구도/시선 흐름/여백 특징" },
      layout: { type: "string", description: "요소 배치/정렬/그리드 특징" },
      typographyVibe: { type: "string", description: "타이포 느낌(있다면)" },
      fontCategory: fontCategoryProperty,
      fontFamily: fontFamilyProperty,
      typography: typographyProperty,
      notes: { type: "string", description: "재현에 도움되는 기타 메모(선택)" },
    },
    required: ["palette", "mood", "composition", "layout", "typographyVibe"],
  },
};

type Media = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
function mediaType(m: string): Media {
  return m === "image/jpeg" || m === "image/png" || m === "image/gif" || m === "image/webp"
    ? m
    : "image/png";
}

/** 레퍼런스 이미지 → 디자인 요소 추출. 실패 시 null(스타일 주입 생략으로 graceful degrade). */
export async function analyzeReferenceDesign(
  imageUrl: string,
  usageContext?: UsageContext,
): Promise<DesignReference | null> {
  try {
    const img = await fetchAsBase64(imageUrl);
    const resp = await callClaude({
      model: "sonnet",
      maxTokens: 800,
      system:
        "당신은 광고 디자인 분석가입니다. 주어진 레퍼런스 이미지에서 '재현 가능한 디자인 요소'만 추출합니다(이미지에 담긴 구체적 콘텐츠/문구가 아니라 색·무드·구도·레이아웃·타이포 느낌). 도구로만 기록.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType(img.mimeType),
                data: img.base64,
              },
            },
            {
              type: "text",
              text: `이 이미지의 디자인 요소를 추출해 ${TOOL} 로 기록하세요.`,
            },
          ],
        },
      ],
      tools: [tool],
      toolChoice: { type: "tool", name: TOOL },
      usageContext,
    });
    const raw = extractToolUse(resp, TOOL);
    if (!raw) return null;
    return normalizeDesignReference(DesignReferenceSchema.parse(raw));
  } catch (e) {
    console.warn("레퍼런스 분석 실패:", (e as Error).message);
    return null;
  }
}

// ── 컨셉 초안 + 디자인 요소 동시 추출 (업로드 직후 1콜) ──────────
const DRAFT_TOOL = "record_reference_draft";

export const ReferenceDraftSchema = DesignReferenceSchema.extend({
  conceptDraft: z.string().min(1).max(400),
});

export interface ReferenceDraft {
  conceptDraft: string;
  design: DesignReference;
}

const draftTool: Tool = {
  name: DRAFT_TOOL,
  description:
    "레퍼런스 이미지를 참고해 (1) 새 광고 이미지의 컨셉 초안과 (2) 재현 가능한 디자인 요소를 함께 기록.",
  input_schema: {
    type: "object",
    properties: {
      conceptDraft: {
        type: "string",
        description:
          "이 레퍼런스를 참고해 새로 만들 광고 이미지의 컨셉 초안(한국어 1~2문장, 장면·소재·분위기). 사용자 핵심 메시지가 있으면 반영.",
      },
      palette: { type: "array", items: { type: "string" }, description: "주요 색 3~6개(hex/색이름)" },
      mood: { type: "string", description: "전체 무드/톤" },
      composition: { type: "string", description: "구도/시선 흐름/여백" },
      layout: { type: "string", description: "요소 배치/정렬" },
      typographyVibe: { type: "string", description: "타이포 느낌(있다면)" },
      fontCategory: fontCategoryProperty,
      fontFamily: fontFamilyProperty,
      typography: typographyProperty,
      notes: { type: "string", description: "재현에 도움되는 메모(선택)" },
    },
    required: ["conceptDraft", "palette", "mood", "composition", "layout", "typographyVibe"],
  },
};

/**
 * 레퍼런스 → 컨셉 초안 + 디자인 요소(1콜). 업로드 직후 호출용.
 * 실패 시 null.
 */
export async function analyzeReferenceForDraft(
  imageUrl: string,
  opts: {
    keyMessage?: string | null;
    brandName?: string | null;
    brandCategory?: string | null;
  } = {},
  usageContext?: UsageContext,
): Promise<ReferenceDraft | null> {
  try {
    const img = await fetchAsBase64(imageUrl);
    const key = opts.keyMessage?.trim() ? `\n사용자 핵심 메시지: ${opts.keyMessage.trim()}` : "";
    const brand = opts.brandName?.trim()
      ? `\n브랜드: ${opts.brandName.trim()}${opts.brandCategory?.trim() ? ` (${opts.brandCategory.trim()})` : ""}`
      : "";
    const resp = await callClaude({
      model: "sonnet",
      maxTokens: 1000,
      system:
        "당신은 광고 아트 디렉터입니다. 주어진 레퍼런스 이미지를 참고해 (1) 새로 만들 광고 이미지의 컨셉 초안과 (2) 재현 가능한 디자인 요소를 추출합니다. 도구로만 기록.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType(img.mimeType), data: img.base64 },
            },
            {
              type: "text",
              text: `이 레퍼런스를 참고해 컨셉 초안과 디자인 요소를 ${DRAFT_TOOL} 로 기록하세요.${key}${brand}`,
            },
          ],
        },
      ],
      tools: [draftTool],
      toolChoice: { type: "tool", name: DRAFT_TOOL },
      usageContext,
    });
    const raw = extractToolUse(resp, DRAFT_TOOL);
    if (!raw) return null;
    const parsed = ReferenceDraftSchema.parse(raw);
    const { conceptDraft, ...design } = parsed;
    return { conceptDraft, design: normalizeDesignReference(design) };
  } catch (e) {
    console.warn("레퍼런스 초안 생성 실패:", (e as Error).message);
    return null;
  }
}

/** DesignReference → 프롬프트 주입용 영어 디스크립터. */
export function formatDesignReference(ref: DesignReference): string {
  const parts: string[] = [];
  if (ref.palette.length) parts.push(`color palette: ${ref.palette.join(", ")}`);
  if (ref.mood) parts.push(`mood: ${ref.mood}`);
  if (ref.composition) parts.push(`composition: ${ref.composition}`);
  if (ref.layout) parts.push(`layout: ${ref.layout}`);
  if (ref.typographyVibe) parts.push(`typography vibe: ${ref.typographyVibe}`);
  if (ref.fontCategory) parts.push(`font class: ${ref.fontCategory}`);
  if (ref.fontFamily) parts.push(`closest installed font: ${ref.fontFamily}`);
  if (ref.typography) {
    const t = ref.typography;
    parts.push(
      `typography geometry: ${t.alignment} aligned, headline size ${t.headlineSizeRatio}H, baseline ${t.headlineYRatio}H, block width ${t.headlineMaxWidthRatio}W, line-height ${t.headlineLineHeight}, weight ${t.headlineWeight}, color ${t.headlineColor}`,
    );
  }
  return parts.join("; ");
}

/** 선택 필드 누락 때문에 분석 전체가 폐기되지 않도록 안전한 카테고리만 보정한다. */
export function normalizeDesignReference(ref: DesignReference): DesignReference {
  if (ref.fontCategory && ref.fontFamily) return ref;
  const vibe = ref.typographyVibe.toLowerCase();
  const fontCategory = /serif|명조|세리프/.test(vibe)
    ? "serif"
    : /round|rounded|둥근/.test(vibe)
      ? "rounded"
      : /hand|script|brush|손글씨|캘리/.test(vibe)
        ? "handwriting"
        : /display|condensed|poster|굵은|타이틀/.test(vibe)
          ? "display"
          : "sans";
  const familyByCategory = {
    sans: "pretendard",
    serif: "nanum-myeongjo",
    rounded: "nanum-square-round",
    display: "gmarket-sans",
    handwriting: "nanum-barunpen",
  } as const;
  return {
    ...ref,
    fontCategory: ref.fontCategory ?? fontCategory,
    fontFamily: ref.fontFamily ?? familyByCategory[ref.fontCategory ?? fontCategory],
  };
}
