import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { VisionAnalysis } from "@/lib/memory/types";
import type { UsageContext } from "@/lib/usage/record";
import { fetchAndResizeForVision } from "@/lib/utils/image-resize-for-vision";
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

// URL 입력은 Vision 호출 전 1024px JPEG로 다운샘플해 이미지 토큰 ~70% 절감.
// base64 입력은 호출자가 이미 제어한 사이즈로 간주하고 그대로 통과.
async function resolveSource(source: ImageSource): Promise<ImageSource> {
  if (source.type !== "url") return source;
  const img = await fetchAndResizeForVision(source.url);
  return {
    type: "base64",
    data: img.base64,
    mediaType: img.mediaType,
  };
}

export async function analyzeBP(input: AnalyzeBPInput): Promise<AnalyzeBPResult> {
  const resolved = await resolveSource(input.source);
  const response = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: buildVisionSystem(),
    messages: buildVisionMessages(resolved, input.context),
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
