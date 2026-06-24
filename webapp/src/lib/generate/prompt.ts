import type { BrandIdentity } from "@/lib/memory/types";
import type { SingleRenderMode } from "./types";

/**
 * 단일 이미지 생성에 주입되는 선택적 브랜드 컨텍스트.
 * 의도적으로 '카테고리'와 '로고'만 사용한다 — 브랜드 색상은 이미지 자유도를
 * 떨어뜨리므로 제외. 로고는 프롬프트 힌트가 아니라 생성 입력 이미지로 전달된다.
 */
export interface BrandContext {
  /** 프롬프트용 영어 힌트(카테고리 등 — 색상 제외) */
  promptHint: string;
  /** 생성에 통합할 대표 로고 URL */
  logoUrl: string | null;
  /**
   * CTA 버튼 배경용 브랜드 primary 색상(예: "#2563EB").
   * 이미지 생성 프롬프트엔 주입하지 않는다(자유도 보존) — 컴포지터 오버레이 버튼에만 사용.
   */
  ctaColor: string | null;
}

export const EMPTY_BRAND_CONTEXT: BrandContext = {
  promptHint: "",
  logoUrl: null,
  ctaColor: null,
};

/** 브랜드 카테고리 + 대표 로고 추출(프롬프트엔 색상 미주입). primary 색상은 CTA 버튼용으로만. */
export function buildBrandContext(
  brand: { category?: string | null } | null,
  identity: BrandIdentity | null,
): BrandContext {
  const logos = identity?.logos_json ?? [];
  const logoUrl = (logos.find((l) => l.is_primary) ?? logos[0])?.url ?? null;
  const colors = identity?.colors_json ?? [];
  const ctaColor = (colors.find((c) => c.role === "primary") ?? colors[0])?.hex ?? null;
  const category = brand?.category?.trim();
  return {
    promptHint: category ? `brand category: ${category}` : "",
    logoUrl,
    ctaColor,
  };
}

function joinSentences(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(" ");
}

interface BasePromptInput {
  concept: string;
  tone?: string | null;
  brand?: BrandContext | null;
  styleHint?: string | null;
  /** 레퍼런스에서 추출한 디자인 디스크립터(이미 문자열로 직렬화됨) */
  designRef?: string | null;
}

interface TextPromptInput extends BasePromptInput {
  headline?: string | null;
  sub?: string | null;
  cta?: string | null;
}

/** 텍스트 없는 깨끗한 광고 배경(오버레이용). 한글은 컴포지터가 얹는다. */
export function buildTextlessBackgroundPrompt(input: BasePromptInput): string {
  return joinSentences([
    "Design a CLEAN, TEXTLESS BACKGROUND for a Korean social media advertisement.",
    "The image MUST contain NO text, letters, numbers, words, or logos of any kind.",
    `Scene / subject: ${input.concept}.`,
    input.styleHint ? `Style: ${input.styleHint}.` : null,
    input.tone ? `Mood / tone: ${input.tone}.` : null,
    input.brand?.promptHint ? `Brand cues: ${input.brand.promptHint}.` : null,
    input.designRef ? `Design reference to mimic: ${input.designRef}.` : null,
    "Leave a calm, uncluttered area with good contrast for overlaid text.",
    "High-quality, professional advertising photography or illustration.",
  ]);
}

/** 이미지에 한글 텍스트까지 직접 렌더(사용자가 'AI가 텍스트도 그리기'를 택했거나 텍스트가 없을 때). */
export function buildFullImagePrompt(input: TextPromptInput): string {
  const textLines: string[] = [];
  if (input.headline) textLines.push(`headline "${input.headline}"`);
  if (input.sub) textLines.push(`subtext "${input.sub}"`);
  if (input.cta) textLines.push(`call-to-action button "${input.cta}"`);

  return joinSentences([
    "Create a polished, professional Korean social media advertisement image.",
    `Scene / subject: ${input.concept}.`,
    input.styleHint ? `Style: ${input.styleHint}.` : null,
    textLines.length
      ? `Render the following Korean text clearly, legibly, and with PERFECT, correct Hangul spelling: ${textLines.join(
          ", ",
        )}. Do not distort or invent Korean characters.`
      : null,
    input.tone ? `Mood / tone: ${input.tone}.` : null,
    input.brand?.promptHint ? `Brand cues: ${input.brand.promptHint}.` : null,
    input.designRef ? `Design reference to mimic: ${input.designRef}.` : null,
    "Strong visual hierarchy, advertising-grade composition.",
  ]);
}

/** 참고 이미지를 변형하는 프롬프트. overlay 모드는 텍스트 없는 배경으로, full 모드는 완성형으로. */
export function buildEditPrompt(input: TextPromptInput & { mode: SingleRenderMode }): string {
  if (input.mode === "overlay") {
    return joinSentences([
      "Transform this image into a clean, professional advertisement background.",
      "Remove or avoid any text, letters, or logos — the result MUST be textless.",
      input.concept ? `Direction: ${input.concept}.` : null,
      input.styleHint ? `Style: ${input.styleHint}.` : null,
      input.tone ? `Mood / tone: ${input.tone}.` : null,
      "Keep the core subject recognizable. Leave a calm area for overlaid text.",
    ]);
  }
  return buildFullImagePrompt(input);
}
