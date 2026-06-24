import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import type { CopyOption } from "./types";

const TOOL = "record_ad_copy";

export const CopyOptionSchema = z.object({
  headline: z.string().min(1).max(24),
  sub: z.string().max(40).optional(),
  cta: z.string().max(16).optional(),
  angle: z.enum([
    "benefit",
    "curiosity",
    "urgency",
    "social_proof",
    "emotional",
  ]),
});

export const CopyListSchema = z.object({
  options: z.array(CopyOptionSchema).min(3).max(6),
});

const tool: Tool = {
  name: TOOL,
  description:
    "광고 소재용 한국어 카피를 서로 다른 앵글로 여러 벌 작성. 각 벌은 headline(짧게)·sub(선택)·cta(선택)·angle.",
  input_schema: {
    type: "object",
    properties: {
      options: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            headline: {
              type: "string",
              description: "핵심 한 줄(권장 8~16자, 최대 24자). 스크롤 멈추게.",
            },
            sub: { type: "string", description: "보조 한 줄(최대 40자). 선택" },
            cta: { type: "string", description: "행동 유도 버튼 문구(최대 16자). 선택" },
            angle: {
              type: "string",
              enum: ["benefit", "curiosity", "urgency", "social_proof", "emotional"],
              description: "혜택/호기심/긴급성/사회적증거/감성 중 하나",
            },
          },
          required: ["headline", "angle"],
        },
      },
    },
    required: ["options"],
  },
};

function buildSystem(tone?: string | null): string {
  const toneLine = tone?.trim() ? `\n톤 오버라이드(우선): ${tone.trim()}` : "";
  return `당신은 한국어 디지털 광고 카피라이터입니다. 한 컨셉에 대해 서로 다른 앵글의 카피를 여러 벌 작성합니다.

## 원칙
- 번역체·AI 티 배제. 자연스러운 한국어 SNS 광고 톤.
- headline은 짧고 강하게(권장 8~16자). 모바일 가독성 우선.
- 앵글을 다양하게: 혜택(benefit)·호기심(curiosity)·긴급성(urgency)·사회적증거(social_proof)·감성(emotional).
- 과장/허위 금지. 입력 사실 범위 안에서.
- cta는 행동 동사 위주(예: 지금 신청, 자세히 보기).${toneLine}

도구 ${TOOL} 로만 기록.`;
}

export async function generateAdCopy(
  input: {
    /** 알릴 핵심 메시지/혜택 — 카피의 1차 입력 */
    keyMessage: string;
    /** 비주얼·장면(선택) — 참고 맥락 */
    concept?: string | null;
    tone?: string | null;
    brandName?: string | null;
    brandCategory?: string | null;
    count?: number;
  },
  usageContext?: UsageContext,
): Promise<CopyOption[]> {
  const count = Math.min(Math.max(input.count ?? 4, 3), 6);
  const brandLine = input.brandName
    ? `${input.brandName}${input.brandCategory ? ` (${input.brandCategory})` : ""}`
    : "";
  const brand = brandLine ? `\n# 브랜드\n${brandLine}` : "";
  const visual = input.concept?.trim()
    ? `\n# 비주얼/장면(참고)\n${input.concept.trim()}`
    : "";
  const resp = await callClaude({
    model: "opus",
    maxTokens: 1500,
    system: buildSystem(input.tone),
    usageContext,
    messages: [
      {
        role: "user",
        content: `# 핵심 메시지/혜택\n${input.keyMessage.trim()}${visual}${brand}

# TASK
위 메시지로 서로 다른 앵글의 광고 카피 ${count}벌을 ${TOOL} 로 기록.`,
      },
    ],
    tools: [tool],
    toolChoice: { type: "tool", name: TOOL },
  });
  const raw = extractToolUse(resp, TOOL);
  if (!raw) throw new Error("카피 생성 실패");
  return CopyListSchema.parse(raw).options;
}
