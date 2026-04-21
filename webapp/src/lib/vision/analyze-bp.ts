import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { VisionAnalysis } from "@/lib/memory/types";
import type { UsageContext } from "@/lib/usage/record";
import {
  BP_VISION_PROMPT_VERSION,
  buildVisionMessages,
  buildVisionSystem,
  visionTool,
  VISION_TOOL_NAME,
  VisionAnalysisSchema,
  type ImageSource,
} from "./prompts";

export interface AnalyzeBPInput {
  source: ImageSource;
  context?: string;
  usageContext?: UsageContext;
}

export interface AnalyzeBPResult {
  analysis: VisionAnalysis;
  promptVersion: string;
}

export async function analyzeBP(input: AnalyzeBPInput): Promise<AnalyzeBPResult> {
  const response = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: buildVisionSystem(),
    messages: buildVisionMessages(input.source, input.context),
    tools: [visionTool],
    toolChoice: { type: "tool", name: VISION_TOOL_NAME },
    usageContext: input.usageContext,
  });

  const raw = extractToolUse(response, VISION_TOOL_NAME);
  if (!raw) throw new Error("Vision 분석 결과를 추출할 수 없습니다");

  const parsed = VisionAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Vision 스키마 검증 실패: ${parsed.error.message}`);
  }
  return {
    analysis: parsed.data as VisionAnalysis,
    promptVersion: BP_VISION_PROMPT_VERSION,
  };
}
