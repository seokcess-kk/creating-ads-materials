import { z } from "zod";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import type { KeyVisualKind } from "@/lib/memory/types";
import { buildVisionMessages, type ImageSource } from "./prompts";

export const KEY_VISUAL_VISION_PROMPT_VERSION = "key-visual-analyze@1.0.0";
const TOOL_NAME = "record_key_visual_analysis";

const KeyVisualAnalysisSchema = z.object({
  description: z.string().min(10).max(400),
  mood_tags: z.array(z.string()).min(1).max(8),
});

export type KeyVisualAnalysis = z.infer<typeof KeyVisualAnalysisSchema>;

const keyVisualTool = {
  name: TOOL_NAME,
  description: "브랜드 실사 자산(Key Visual)을 서술·무드 태그로 기록",
  input_schema: {
    type: "object" as const,
    properties: {
      description: {
        type: "string",
        description:
          "한국어로 이 이미지에 무엇이 있는지 객관적 서술 (50~150자). 인물이면 외형·의상·표정·배경, 공간이면 구성·조명·분위기, 제품이면 형태·재질·배치.",
      },
      mood_tags: {
        type: "array",
        items: { type: "string" },
        description:
          "이미지의 분위기를 나타내는 영어 태그 3~6개 (예: bright, warm, modern, professional, cozy, vintage, clean, vibrant, minimal, natural)",
      },
    },
    required: ["description", "mood_tags"],
  },
};

function buildSystem(kind: KeyVisualKind): string {
  const kindHint =
    kind === "person"
      ? "인물 사진 — 외형·의상·표정·시선 방향·배경을 객관적으로 서술 (이름/나이/성별 단정 금지, 관찰된 외형만)"
      : kind === "space"
        ? "공간 사진 — 공간 유형·구성·조명·색조·분위기·규모감을 서술"
        : "제품 사진 — 제품 유형·재질·색상·형태·배치·배경을 서술";

  return `당신은 광고 소재 기획을 돕는 비주얼 분석가입니다.
주어진 실사 이미지를 객관적·구조적으로 관찰하여 ${TOOL_NAME} 도구로 기록하세요.

이미지 종류: ${kindHint}

규칙:
- 추측 금지. 이미지에서 관찰 가능한 사실만 기술
- 광고 카피·레이아웃 기획에 활용될 정보 위주 (여백 위치, 피사체 방향, 주 색조 등)
- description은 한국어 자연어 50~150자
- mood_tags는 영어 소문자 3~6개
- 인물의 경우 구체적 나이·성별·국적·직업을 단정하지 않는다`;
}

export interface AnalyzeKeyVisualInput {
  source: ImageSource;
  kind: KeyVisualKind;
  usageContext?: UsageContext;
}

export interface AnalyzeKeyVisualResult {
  analysis: KeyVisualAnalysis;
  promptVersion: string;
}

export async function analyzeKeyVisual(
  input: AnalyzeKeyVisualInput,
): Promise<AnalyzeKeyVisualResult> {
  const messages: MessageParam[] = buildVisionMessages(input.source);
  const response = await callClaude({
    model: "sonnet",
    maxTokens: 1000,
    system: buildSystem(input.kind),
    messages,
    tools: [keyVisualTool],
    toolChoice: { type: "tool", name: TOOL_NAME },
    usageContext: input.usageContext,
  });

  const raw = extractToolUse(response, TOOL_NAME);
  if (!raw) throw new Error("Key Visual 분석 결과를 추출할 수 없습니다");

  const parsed = KeyVisualAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Key Visual 스키마 검증 실패: ${parsed.error.message}`);
  }
  return {
    analysis: parsed.data,
    promptVersion: KEY_VISUAL_VISION_PROMPT_VERSION,
  };
}
