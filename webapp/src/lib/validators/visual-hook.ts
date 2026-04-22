import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import {
  VISUAL_VALIDATOR_TOOL,
  VISUAL_BATCH_VALIDATOR_TOOL,
  VisualValidatorSchema,
  VisualBatchValidatorSchema,
  buildValidatorMessages,
  buildBatchValidatorMessages,
  buildValidatorSystem,
  visualValidatorTool,
  visualBatchValidatorTool,
  type ValidatorBatchItem,
  type VisualBatchValidatorItem,
  type VisualPromptContext,
  type VisualValidatorResult,
  type VisualVariantSpec,
} from "@/lib/prompts/visual";

export async function validateVisualImage(
  imageUrl: string,
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
  usageContext?: UsageContext,
): Promise<VisualValidatorResult> {
  const response = await callClaude({
    model: "opus",
    maxTokens: 1500,
    system: buildValidatorSystem(),
    messages: buildValidatorMessages(imageUrl, ctx, spec),
    tools: [visualValidatorTool],
    toolChoice: { type: "tool", name: VISUAL_VALIDATOR_TOOL },
    usageContext,
  });

  const raw = extractToolUse(response, VISUAL_VALIDATOR_TOOL);
  if (!raw) throw new Error("Validator 결과를 추출할 수 없습니다");

  const parsed = VisualValidatorSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validator 스키마 검증 실패: ${parsed.error.message}`);
  }
  return parsed.data;
}

// 여러 variant를 한 번의 Claude 호출로 평가한다.
// 반환은 variantId → 결과 맵. 누락된 variantId는 호출자가 fallback 처리.
export async function validateVisualImagesBatch(
  items: ValidatorBatchItem[],
  ctx: VisualPromptContext,
  usageContext?: UsageContext,
): Promise<Map<string, VisualBatchValidatorItem>> {
  if (items.length === 0) return new Map();

  const response = await callClaude({
    model: "opus",
    // variant 수 × 개별 평가 결과 분량 고려.
    maxTokens: Math.max(1500, items.length * 800),
    system: buildValidatorSystem(),
    messages: buildBatchValidatorMessages(items, ctx),
    tools: [visualBatchValidatorTool],
    toolChoice: { type: "tool", name: VISUAL_BATCH_VALIDATOR_TOOL },
    usageContext,
  });

  const raw = extractToolUse(response, VISUAL_BATCH_VALIDATOR_TOOL);
  if (!raw) throw new Error("Batch Validator 결과를 추출할 수 없습니다");

  const parsed = VisualBatchValidatorSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Batch Validator 스키마 검증 실패: ${parsed.error.message}`);
  }

  const map = new Map<string, VisualBatchValidatorItem>();
  for (const v of parsed.data.variants) map.set(v.variantId, v);
  return map;
}
