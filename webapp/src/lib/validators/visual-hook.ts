import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import {
  VISUAL_VALIDATOR_TOOL,
  VisualValidatorSchema,
  buildValidatorMessages,
  buildValidatorSystem,
  visualValidatorTool,
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
