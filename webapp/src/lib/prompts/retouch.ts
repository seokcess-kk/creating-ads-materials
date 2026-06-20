import type { BrandMemory } from "@/lib/memory/types";
import type { CopyVariant } from "./copy";

export const RETOUCH_PROMPT_VERSION = "retouch@1.1.0";

export interface RetouchPromptContext {
  memory: BrandMemory;
  instruction: string;
  keepCompositionStrict?: boolean;
  // 선택된 카피 — 카피-이미지 정합을 위해 retouch가 카피를 인지하도록.
  selectedCopy?: CopyVariant | null;
  // notice 모드: 대상 이미지는 textless 배경(텍스트는 compose에서 오버레이).
  isNotice?: boolean;
}

export function buildRetouchPrompt(ctx: RetouchPromptContext): string {
  const colors =
    ctx.memory.identity?.colors_json?.map((c) => c.hex).join(", ") ?? "";
  const strictness = ctx.keepCompositionStrict
    ? "Make only minimal targeted changes. Keep layout, subjects, and palette tightly intact."
    : "Apply the edit precisely. Allow composition adjustments only where the instruction requires.";

  if (ctx.isNotice) {
    const copy = ctx.selectedCopy;
    const zoneHint = copy
      ? `: "${copy.headline}" / "${copy.subCopy}" / "${copy.cta}"`
      : "";
    return `You are given a TEXTLESS background image for an informational notice card. Korean text (headline / sub copy / CTA) and the brand logo are composited ON TOP in a later step — this image must remain completely text-free and logo-free.

# Instruction
${ctx.instruction}

# Constraints
- Do NOT add, draw, or render ANY text, letters, numbers, or typography of any language.
- Do NOT add any logo, brand mark, icon, watermark, badge, or emblem.
- Keep a clean, uncluttered region (center/upper) with high legibility for the text that will be overlaid later${zoneHint}. Do not place busy patterns where that text will sit.
- ${strictness}
- Sober, clear, trustworthy, administrative tone. Avoid premium/gold flashiness unless the instruction explicitly asks otherwise.
- Brand palette to maintain: ${colors || "(unspecified)"}
- Avoid before/after comparison layouts.`;
  }

  const copyHint = ctx.selectedCopy
    ? `\n- Current copy (keep consistent unless the instruction changes wording) — headline: "${ctx.selectedCopy.headline}" / sub: "${ctx.selectedCopy.subCopy}" / CTA: "${ctx.selectedCopy.cta}"`
    : "";

  return `Edit the provided 1:1 final Korean ad creative according to the instruction. The image already contains the complete design including Korean headline, sub copy, and CTA button typography. Respect or update them precisely as instructed.${copyHint}

# Instruction
${ctx.instruction}

# Constraints
- Aspect ratio: 1:1 (1080x1080)
- The image is a FINAL creative: keep Korean typography crisp and legible
- If the instruction asks to change text/copy wording, update the existing typography with the new Korean text (do not leave both old and new text)
- If the instruction does NOT mention text, keep existing copy text exactly unchanged
- ${strictness}
- Brand palette to maintain: ${colors || "(unspecified)"}
- Do NOT add, draw, or enhance any logo, brand mark, icon, watermark, badge, or emblem anywhere (logos are overlaid in the compose step)
- Avoid before/after comparison, individual facial close-ups with demographic labeling
- Keep premium performance-ad aesthetic`;
}
