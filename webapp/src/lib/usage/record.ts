import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateClaudeCost,
  estimateGeminiImageCost,
  estimateGeminiEmbeddingCost,
  estimateOpenAIImageCost,
  GEMINI_IMAGE_PRICING,
} from "./pricing";

export type UsageProvider = "anthropic" | "gemini" | "openai";

export interface UsageContext {
  operation: string;
  brandId?: string | null;
  campaignId?: string | null;
  runId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordUsageInput extends UsageContext {
  provider: UsageProvider;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  imageCount?: number;
  /** OpenAI 이미지 단가 계산용 (예: "1024x1536") */
  imageDimensions?: string | null;
  /** OpenAI 이미지 단가 계산용 (low|medium|high) */
  imageQuality?: string | null;
  /** Gemini 임베딩 토큰 추정치 — 이미지 단가로 잘못 과금되지 않도록 */
  approxTokens?: number | null;
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  let cost = 0;
  if (input.provider === "anthropic") {
    cost = estimateClaudeCost(input.model, {
      input: input.inputTokens ?? 0,
      output: input.outputTokens ?? 0,
      cacheRead: input.cacheReadTokens,
      cacheCreation: input.cacheCreationTokens,
    });
  } else if (input.provider === "gemini") {
    // 이미지 모델만 장당 단가로 계산하고, 그 외(임베딩 등)는 토큰 기반으로 분리한다.
    // 과거에는 임베딩도 이미지 단가($0.04/장)로 계상되는 버그가 있었다.
    const isImageModel = input.model != null && input.model in GEMINI_IMAGE_PRICING;
    cost = isImageModel
      ? estimateGeminiImageCost(input.model, input.imageCount ?? 1)
      : estimateGeminiEmbeddingCost(input.approxTokens ?? 0);
  } else if (input.provider === "openai") {
    cost = estimateOpenAIImageCost(
      input.model,
      input.imageDimensions,
      input.imageQuality,
      input.imageCount ?? 1,
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("api_usage").insert({
    provider: input.provider,
    operation: input.operation,
    model: input.model ?? null,
    brand_id: input.brandId ?? null,
    campaign_id: input.campaignId ?? null,
    run_id: input.runId ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    cache_read_tokens: input.cacheReadTokens ?? null,
    cache_creation_tokens: input.cacheCreationTokens ?? null,
    image_count: input.imageCount ?? null,
    estimated_cost_usd: cost,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.warn("API usage 기록 실패:", error.message);
  }
}
