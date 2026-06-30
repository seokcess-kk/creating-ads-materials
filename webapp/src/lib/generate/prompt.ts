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
  /**
   * 합성에 쓸 로고 에셋 목록(primary 우선 정렬). 생성 후 컴포지터가 1개만 오버레이하며,
   * 여러 에셋이 있으면 배경 대비에 맞춰(밝은 곳엔 어두운 로고) 자동 선택한다.
   */
  logos: { url: string; label: string | null }[];
  /**
   * CTA 버튼 배경용 브랜드 primary 색상(예: "#2563EB").
   * 이미지 생성 프롬프트엔 주입하지 않는다(자유도 보존) — 컴포지터 오버레이 버튼에만 사용.
   */
  ctaColor: string | null;
}

export const EMPTY_BRAND_CONTEXT: BrandContext = {
  promptHint: "",
  logos: [],
  ctaColor: null,
};

/** 브랜드 카테고리 + 로고 에셋 추출(프롬프트엔 색상 미주입). primary 색상은 CTA 버튼용으로만. */
export function buildBrandContext(
  brand: { category?: string | null } | null,
  identity: BrandIdentity | null,
): BrandContext {
  const raw = identity?.logos_json ?? [];
  // primary를 앞으로 정렬(자동 선택 실패/대비 동률 시 우선 사용).
  const logos = [...raw]
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
    .map((l) => ({ url: l.url, label: l.label ?? null }));
  const colors = identity?.colors_json ?? [];
  const ctaColor = (colors.find((c) => c.role === "primary") ?? colors[0])?.hex ?? null;
  const category = brand?.category?.trim();
  return {
    promptHint: category ? `brand category: ${category}` : "",
    logos,
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
  /** 알릴 핵심 메시지/혜택(필수) */
  keyMessage: string;
  /** 비주얼·장면(선택) */
  concept?: string | null;
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
    "High-quality, professional Korean social-media advertisement background, CLEAN and TEXTLESS.",
    `Communicates: ${input.keyMessage}.`,
    input.concept?.trim() ? `Hero scene / subject: ${input.concept.trim()}.` : null,
    input.styleHint ? `Style: ${input.styleHint}.` : null,
    "Keep the hero subject and busy detail in the upper portion; reserve a clean, low-detail band across the center and lower third (good, even contrast) for Korean copy overlaid later.",
    "Soft professional lighting with a clear focal point; a limited, cohesive color palette.",
    input.tone ? `Mood / tone: ${input.tone}.` : null,
    input.brand?.promptHint ? `Brand cues: ${input.brand.promptHint}.` : null,
    input.designRef ? `Design reference to mimic: ${input.designRef}.` : null,
    "Exclusions: no text, no letters, no numbers, no logos, no watermark, no UI elements.",
  ]);
}

/** 이미지에 한글 텍스트까지 직접 렌더(사용자가 'AI가 텍스트도 그리기'를 택했거나 텍스트가 없을 때). */
export function buildFullImagePrompt(input: TextPromptInput): string {
  const textLines: string[] = [];
  if (input.headline) textLines.push(`headline "${input.headline}"`);
  if (input.sub) textLines.push(`subtext "${input.sub}"`);
  if (input.cta) textLines.push(`call-to-action button "${input.cta}"`);

  return joinSentences([
    "Polished, professional Korean social-media advertisement design, clean modern advertising style.",
    `Communicates: ${input.keyMessage}.`,
    input.concept?.trim() ? `Hero scene / subject: ${input.concept.trim()}.` : null,
    input.styleHint ? `Style: ${input.styleHint}.` : null,
    "Soft professional lighting, clear focal point, a limited cohesive color palette.",
    textLines.length
      ? `Render the following Korean text with PERFECT, correct modern Hangul — make the headline dominant and large, any sub a clearly smaller subtitle: ${textLines.join(
          ", ",
        )}. Use only these exact strings; do not distort, invent, or add characters.`
      : null,
    input.tone ? `Mood / tone: ${input.tone}.` : null,
    input.brand?.promptHint ? `Brand cues: ${input.brand.promptHint}.` : null,
    input.designRef ? `Design reference to mimic: ${input.designRef}.` : null,
    "Do NOT draw any brand logo or wordmark (the logo is added separately afterwards).",
    "Strong visual hierarchy, generous whitespace, advertising-grade composition.",
  ]);
}

/** 참고 이미지를 변형하는 프롬프트. overlay 모드는 텍스트 없는 배경으로, full 모드는 완성형으로. */
export function buildEditPrompt(input: TextPromptInput & { mode: SingleRenderMode }): string {
  if (input.mode === "overlay") {
    return joinSentences([
      "Transform this image into a clean, professional advertisement background.",
      "Remove or avoid any text, letters, or logos — the result MUST be textless.",
      `Suit an advertisement about: ${input.keyMessage}.`,
      input.concept?.trim() ? `Direction: ${input.concept.trim()}.` : null,
      input.styleHint ? `Style: ${input.styleHint}.` : null,
      input.tone ? `Mood / tone: ${input.tone}.` : null,
      "Keep the core subject recognizable. Leave a calm area for overlaid text.",
    ]);
  }
  return buildFullImagePrompt(input);
}
