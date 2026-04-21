export interface ClaudePricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite?: number;
}

export const CLAUDE_PRICING: Record<string, ClaudePricing> = {
  "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheRead: 0.08 },
};

export const GEMINI_IMAGE_PRICING: Record<string, number> = {
  "gemini-3-pro-image-preview": 0.04,
  "gemini-3-pro-image": 0.04,
};

export function estimateClaudeCost(
  model: string | null | undefined,
  usage: {
    input: number;
    output: number;
    cacheRead?: number;
  },
): number {
  const p: ClaudePricing =
    (model ? CLAUDE_PRICING[model] : undefined) ??
    CLAUDE_PRICING["claude-opus-4-7"];
  const input = (usage.input * p.input) / 1_000_000;
  const output = (usage.output * p.output) / 1_000_000;
  const cacheRead = ((usage.cacheRead ?? 0) * p.cacheRead) / 1_000_000;
  return input + output + cacheRead;
}

export function estimateGeminiImageCost(
  model: string | null | undefined,
  count: number,
): number {
  const p: number =
    (model ? GEMINI_IMAGE_PRICING[model] : undefined) ?? 0.04;
  return p * count;
}

export function getPricingNote(): string {
  return "2026-01 기준 추정 단가. 실제 청구와 차이 가능.";
}
