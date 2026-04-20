import { z } from "zod";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export const BP_VISION_PROMPT_VERSION = "bp-analyze@1.0.0";
export const VISION_TOOL_NAME = "record_bp_analysis";

export const VisionAnalysisSchema = z.object({
  layout: z
    .object({
      textZone: z.enum(["top", "center", "bottom", "mixed"]).optional(),
      marginRatio: z.number().min(0).max(1).optional(),
      hierarchy: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
  color: z
    .object({
      palette: z.array(z.string()).optional(),
      contrastRatio: z.number().optional(),
      mood: z.string().optional(),
    })
    .optional(),
  typography: z
    .object({
      style: z.string().optional(),
      sizeRatio: z.record(z.string(), z.number()).optional(),
    })
    .optional(),
  hookElement: z
    .object({
      type: z.string().optional(),
      placement: z.string().optional(),
    })
    .optional(),
  copyStructure: z
    .object({
      headlineLen: z.number().int().optional(),
      hookType: z.string().optional(),
      framework: z.string().optional(),
    })
    .optional(),
  brandElements: z
    .object({
      logoPosition: z.string().optional(),
      logoSizeRatio: z.number().optional(),
      ctaStyle: z.string().optional(),
    })
    .optional(),
  channelFit: z.record(z.string(), z.number()).optional(),
  funnelFit: z.record(z.string(), z.number()).optional(),
  notes: z.string().optional(),
});

export const visionTool = {
  name: VISION_TOOL_NAME,
  description: "광고 소재(BP)를 8축으로 구조화하여 기록",
  input_schema: {
    type: "object" as const,
    properties: {
      layout: {
        type: "object",
        description: "텍스트 배치와 계층",
        properties: {
          textZone: {
            type: "string",
            enum: ["top", "center", "bottom", "mixed"],
          },
          marginRatio: { type: "number", description: "여백 비율 0~1" },
          hierarchy: { type: "integer", description: "시각 계층 수 1~5" },
        },
      },
      color: {
        type: "object",
        properties: {
          palette: {
            type: "array",
            items: { type: "string" },
            description: "주요 HEX 3~5개",
          },
          contrastRatio: { type: "number" },
          mood: { type: "string", description: "vivid|calm|dark|pastel 등" },
        },
      },
      typography: {
        type: "object",
        properties: {
          style: {
            type: "string",
            description: "geometric_sans|serif|handwriting|display 등",
          },
          sizeRatio: {
            type: "object",
            description: "{h:1, s:0.5, c:0.4} 형태 비율",
            additionalProperties: { type: "number" },
          },
        },
      },
      hookElement: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "number|face|product|arrow|before_after|quote|badge",
          },
          placement: { type: "string" },
        },
      },
      copyStructure: {
        type: "object",
        properties: {
          headlineLen: { type: "integer" },
          hookType: {
            type: "string",
            description: "empathy|problem|insight|emotion|curiosity|number|benefit",
          },
          framework: {
            type: "string",
            description: "AIDA|PAS|BAB|FAB|4U|none",
          },
        },
      },
      brandElements: {
        type: "object",
        properties: {
          logoPosition: { type: "string" },
          logoSizeRatio: { type: "number" },
          ctaStyle: {
            type: "string",
            description: "pill|rectangle|underline|arrow|none",
          },
        },
      },
      channelFit: {
        type: "object",
        description: "채널별 적합도 0~1 (ig|fb|tiktok|gdn|x)",
        additionalProperties: { type: "number" },
      },
      funnelFit: {
        type: "object",
        description: "퍼널 적합도 0~1 (TOFU|MOFU|BOFU)",
        additionalProperties: { type: "number" },
      },
      notes: { type: "string" },
    },
  },
};

export function buildVisionSystem(): string {
  return `당신은 광고 소재를 분석하는 시니어 크리에이티브 디렉터입니다.
주어진 광고 이미지를 객관적·구조적으로 평가하여 ${VISION_TOOL_NAME} 도구로 결과를 반환하세요.

규칙:
- 추측보다 이미지에서 관찰 가능한 사실 위주로 평가
- 색상은 HEX로, 비율은 0~1로 수치화
- 한국어 광고의 경우 글자수는 공백·기호 제외
- 각 필드는 확신이 있을 때만 채우고, 모호하면 생략
- 퍼포먼스 광고 관점(3초 스크롤 멈춤·CTR·전환 유도)에서 평가
- 채널/퍼널 적합도는 광고 목적 관점에서 판단`;
}

export type ImageSource =
  | { type: "url"; url: string }
  | { type: "base64"; data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export function buildVisionMessages(source: ImageSource, context?: string): MessageParam[] {
  const imageBlock =
    source.type === "url"
      ? ({
          type: "image" as const,
          source: { type: "url" as const, url: source.url },
        } as const)
      : ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: source.mediaType,
            data: source.data,
          },
        } as const);

  return [
    {
      role: "user",
      content: [
        imageBlock,
        {
          type: "text" as const,
          text: `${context ? context + "\n\n" : ""}이 광고 이미지를 8축으로 분석하고 ${VISION_TOOL_NAME} 도구로 결과를 기록하세요.`,
        },
      ],
    },
  ];
}
