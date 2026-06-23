import type { BrandIdentity } from "@/lib/memory/types";
import type { SingleRenderMode } from "./types";

/** 단일 이미지 생성에 주입되는 선택적 브랜드 컨텍스트(경량 — identity만). */
export interface BrandContext {
  /** Gemini/OpenAI 프롬프트용 영어 힌트 */
  promptHint: string;
  /** 컴포지터 CTA 버튼 배경색 */
  primaryColor: string | null;
  accentColor: string | null;
  /** 컴포지터 로고 오버레이 URL */
  logoUrl: string | null;
}

export const EMPTY_BRAND_CONTEXT: BrandContext = {
  promptHint: "",
  primaryColor: null,
  accentColor: null,
  logoUrl: null,
};

/** identity → 경량 브랜드 컨텍스트(컬러/로고/톤). loadBrandMemory 미사용. */
export function buildBrandContext(identity: BrandIdentity | null): BrandContext {
  if (!identity) return EMPTY_BRAND_CONTEXT;
  const colors = identity.colors_json ?? [];
  const primary = colors.find((c) => c.role === "primary")?.hex ?? null;
  const accent =
    colors.find((c) => c.role === "accent")?.hex ??
    colors.find((c) => c.role === "secondary")?.hex ??
    null;
  const logos = identity.logos_json ?? [];
  const logoUrl = (logos.find((l) => l.is_primary) ?? logos[0])?.url ?? null;
  const tone = identity.voice_json?.tone;

  const parts: string[] = [];
  if (primary) parts.push(`brand primary color ${primary}`);
  if (accent) parts.push(`accent color ${accent}`);
  if (tone) parts.push(`brand tone: ${tone}`);

  return {
    promptHint: parts.join(", "),
    primaryColor: primary,
    accentColor: accent,
    logoUrl,
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
