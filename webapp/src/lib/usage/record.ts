import { createAdminClient } from "@/lib/supabase/admin";
import { estimateClaudeCost, estimateGeminiImageCost } from "./pricing";

export type UsageProvider = "anthropic" | "gemini";

export interface UsageContext {
  operation: string;
  brandId?: string | null;
  campaignId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordUsageInput extends UsageContext {
  provider: UsageProvider;
  model?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  imageCount?: number;
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  let cost = 0;
  if (input.provider === "anthropic") {
    cost = estimateClaudeCost(input.model, {
      input: input.inputTokens ?? 0,
      output: input.outputTokens ?? 0,
      cacheRead: input.cacheReadTokens,
    });
  } else if (input.provider === "gemini") {
    cost = estimateGeminiImageCost(input.model, input.imageCount ?? 1);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("api_usage").insert({
    provider: input.provider,
    operation: input.operation,
    model: input.model ?? null,
    brand_id: input.brandId ?? null,
    campaign_id: input.campaignId ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    cache_read_tokens: input.cacheReadTokens ?? null,
    image_count: input.imageCount ?? null,
    estimated_cost_usd: cost,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.warn("API usage 기록 실패:", error.message);
  }
}
