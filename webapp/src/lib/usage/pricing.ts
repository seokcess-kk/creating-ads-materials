export interface ClaudePricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite?: number;
}

// cacheWrite는 기본 input의 1.25배 (ephemeral 5분 TTL 기준).
export const CLAUDE_PRICING: Record<string, ClaudePricing> = {
  "claude-opus-4-7": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1.0 },
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
    cacheCreation?: number;
  },
): number {
  const p: ClaudePricing =
    (model ? CLAUDE_PRICING[model] : undefined) ??
    CLAUDE_PRICING["claude-opus-4-7"];
  const input = (usage.input * p.input) / 1_000_000;
  const output = (usage.output * p.output) / 1_000_000;
  const cacheRead = ((usage.cacheRead ?? 0) * p.cacheRead) / 1_000_000;
  const cacheWrite =
    ((usage.cacheCreation ?? 0) * (p.cacheWrite ?? p.input * 1.25)) / 1_000_000;
  return input + output + cacheRead + cacheWrite;
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
