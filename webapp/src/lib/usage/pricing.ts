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

// Gemini 임베딩(gemini-embedding-001)은 토큰 기반 과금이다. 이미지 단가($0.04/장)와
// 섞이면 임베딩 1회가 이미지 1장으로 계상되므로 별도 단가로 분리한다.
// 단가는 추정치(2026 기준) — 정확한 값은 Google 가격표로 확인할 것.
export const GEMINI_EMBEDDING_PRICE_PER_1M = 0.15; // USD / 1M input tokens (추정)

// 토큰 수를 알 수 없을 때는 문자 길이로 근사한다(영문 ~4자/토큰, 한국어는 더 짧지만 보수적).
export function estimateGeminiEmbeddingCost(approxTokens: number): number {
  return (Math.max(0, approxTokens) * GEMINI_EMBEDDING_PRICE_PER_1M) / 1_000_000;
}

// OpenAI 이미지 — model→size→quality 장당 단가(USD, 추정).
// 최신 모델/단가는 OpenAI 가격 문서로 확인 후 갱신할 것.
type ImagePriceTable = Record<string, Record<string, number>>;

const OPENAI_IMAGE_PRICING_BY_MODEL: Record<string, ImagePriceTable> = {
  "gpt-image-2": {
    "1024x1024": { low: 0.02, medium: 0.053, high: 0.211 },
    "1024x1536": { low: 0.03, medium: 0.08, high: 0.3 },
    "1536x1024": { low: 0.03, medium: 0.08, high: 0.3 },
  },
  "gpt-image-1.5": {
    "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
    "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
  },
  "gpt-image-1": {
    "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
    "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
  },
  "gpt-image-1-mini": {
    "1024x1024": { low: 0.005, medium: 0.011, high: 0.042 },
    "1024x1536": { low: 0.008, medium: 0.016, high: 0.063 },
    "1536x1024": { low: 0.008, medium: 0.016, high: 0.063 },
  },
};

export function estimateOpenAIImageCost(
  model: string | null | undefined,
  size: string | null | undefined,
  quality: string | null | undefined,
  count: number,
): number {
  const knownTable = model ? OPENAI_IMAGE_PRICING_BY_MODEL[model] : undefined;
  if (model && !knownTable) {
    console.warn(`알 수 없는 OpenAI 이미지 모델 단가(${model}) → gpt-image-2 단가로 추정`);
  }
  const modelTable = knownTable ?? OPENAI_IMAGE_PRICING_BY_MODEL["gpt-image-2"];
  const sizeTable =
    (size ? modelTable[size] : undefined) ?? modelTable["1024x1024"];
  const per = (quality ? sizeTable[quality] : undefined) ?? sizeTable["medium"];
  return per * count;
}

// OpenAI 이미지 — 토큰 기반 단가(USD / 1M tokens). API 응답(response.usage)이 있을 때
// 장당 추정 테이블보다 정확하다(특히 입력 이미지가 여러 장인 edit). 출처: OpenAI pricing(2026-06).
// cachedInput(캐시 입력 할인)은 OpenAI 이미지 응답이 캐시 토큰을 분리 보고하지 않아 적용 불가 →
// 의도적으로 단가 테이블에서 제외(불사용 필드로 두면 추후 오해 소지). 분리 보고가 생기면 그때 추가.
export interface OpenAIImageTokenRates {
  textInput: number;
  imageInput: number;
  output: number;
}

const OPENAI_IMAGE_TOKEN_PRICING: Record<string, OpenAIImageTokenRates> = {
  "gpt-image-2": { textInput: 5, imageInput: 8, output: 30 },
  "gpt-image-1.5": { textInput: 5, imageInput: 8, output: 32 },
  "gpt-image-1": { textInput: 5, imageInput: 10, output: 40 },
  "gpt-image-1-mini": { textInput: 2, imageInput: 2.5, output: 8 },
};

/** 실제 토큰 사용량으로 OpenAI 이미지 비용을 계산(토큰을 알 때만 사용; 모르면 장당 테이블 폴백). */
export function estimateOpenAIImageTokenCost(
  model: string | null | undefined,
  usage: { textInputTokens: number; imageInputTokens: number; outputTokens: number },
): number {
  const known = model ? OPENAI_IMAGE_TOKEN_PRICING[model] : undefined;
  if (model && !known) {
    console.warn(`알 수 없는 OpenAI 이미지 모델 단가(${model}) → gpt-image-2 단가로 추정`);
  }
  const r = known ?? OPENAI_IMAGE_TOKEN_PRICING["gpt-image-2"];
  return (
    (Math.max(0, usage.textInputTokens) * r.textInput +
      Math.max(0, usage.imageInputTokens) * r.imageInput +
      Math.max(0, usage.outputTokens) * r.output) /
    1_000_000
  );
}

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
