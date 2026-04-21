import type { BrandMemory } from "@/lib/memory/types";

export const RETOUCH_PROMPT_VERSION = "retouch@1.0.0";

export interface RetouchPromptContext {
  memory: BrandMemory;
  instruction: string;
  keepCompositionStrict?: boolean;
}

export function buildRetouchPrompt(ctx: RetouchPromptContext): string {
  const colors =
    ctx.memory.identity?.colors_json?.map((c) => c.hex).join(", ") ?? "";
  const strictness = ctx.keepCompositionStrict
    ? "Make only minimal targeted changes. Keep layout, subjects, and palette tightly intact."
    : "Apply the edit precisely. Allow composition adjustments only where the instruction requires.";

  return `Edit the provided 1:1 final Korean ad creative according to the instruction. The image already contains the complete design including Korean headline, sub copy, and CTA button typography. Respect or update them precisely as instructed.

# Instruction
${ctx.instruction}

# Constraints
- Aspect ratio: 1:1 (1080x1080)
- The image is a FINAL creative: keep Korean typography crisp and legible
- If the instruction asks to change text/copy wording, update the existing typography with the new Korean text (do not leave both old and new text)
- If the instruction does NOT mention text, keep existing copy text exactly unchanged
- ${strictness}
- Brand palette to maintain: ${colors || "(unspecified)"}
- Do NOT draw a logo in the top-left logo area (a logo will be overlaid later in compose)
- Avoid before/after comparison, individual facial close-ups with demographic labeling
- Keep premium performance-ad aesthetic`;
}
