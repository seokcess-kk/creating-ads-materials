import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type {
  Brand,
  BrandAudience,
  BrandIdentity,
  BrandKeyVisual,
  BrandOffer,
} from "@/lib/memory/types";
import type { UsageContext } from "@/lib/usage/record";

export const OFFER_DRAFT_VERSION = "offer-draft@1.0.0";
export const OFFER_DRAFT_TOOL = "record_offer_drafts";

const OfferDraftSchema = z.object({
  title: z.string().min(1).max(40),
  usp: z.string().min(1).max(120),
  price: z.string().nullable().optional(),
  benefits: z.array(z.string().min(1).max(40)).min(2).max(6),
  urgency: z.string().nullable().optional(),
  evidence: z.array(z.string().min(1).max(60)).max(4).optional(),
  angle: z.string(),
  rationale: z.string(),
});
export type OfferDraft = z.infer<typeof OfferDraftSchema>;

export const OfferDraftBatchSchema = z.object({
  drafts: z.array(OfferDraftSchema).min(2).max(6),
});
export type OfferDraftBatch = z.infer<typeof OfferDraftBatchSchema>;

const offerDraftTool: Tool = {
  name: OFFER_DRAFT_TOOL,
  description: "광고 오퍼 초안 4개를 다양한 앵글로 생성합니다",
  input_schema: {
    type: "object",
    properties: {
      drafts: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        description: "각각 다른 앵글의 오퍼 초안. 보통 3~4개.",
        items: {
          type: "object",
          required: ["title", "usp", "benefits", "angle", "rationale"],
          properties: {
            title: {
              type: "string",
              description: "오퍼 타이틀 (최대 16자 권장, 절대 40자 초과 금지)",
            },
            usp: {
              type: "string",
              description: "한 줄 핵심 가치 제안 (40자 이내 권장)",
            },
            price: {
              type: "string",
              description: "가격 표기 (사용자 의도에서 가격 노출 OK일 때만). 없으면 생략.",
            },
            benefits: {
              type: "array",
              items: { type: "string" },
              description: "구체적 혜택 3~5개. 검증 가능한 사실만.",
            },
            urgency: {
              type: "string",
              description: "긴급성·희소성 (예: 정원제·대기 등록). 없으면 생략.",
            },
            evidence: {
              type: "array",
              items: { type: "string" },
              description: "신뢰 증거 — 수치·인증·경력 등. 검증 불가 표현 금지.",
            },
            angle: {
              type: "string",
              description:
                "이 오퍼의 광고 앵글 (예: 통증 직격 / 시간 강도 / 사회적 증거 / 희소성)",
            },
            rationale: {
              type: "string",
              description:
                "왜 이 페르소나에게 이 앵글이 효과적인지 1~2문장",
            },
          },
        },
      },
    },
    required: ["drafts"],
  },
};

export interface GenerateOffersInput {
  brand: Brand;
  identity: BrandIdentity | null;
  audience: BrandAudience;
  keyVisuals: BrandKeyVisual[];
  existingOffers: BrandOffer[];
  intent: string;
  channel?: string;
  count: number;
  usageContext?: UsageContext;
}

function summarizeKeyVisuals(visuals: BrandKeyVisual[]): string {
  if (visuals.length === 0) return "(키비주얼 없음)";
  return visuals
    .slice(0, 8)
    .map(
      (kv, i) =>
        `${i + 1}. [${kv.kind}] ${kv.label} — ${kv.description ?? "(설명 없음)"} mood:${kv.mood_tags.join(",")}`,
    )
    .join("\n");
}

function summarizeExistingOffers(offers: BrandOffer[]): string {
  if (offers.length === 0) return "(기존 오퍼 없음)";
  return offers
    .map(
      (o, i) =>
        `${i + 1}. ${o.title}${o.usp ? ` — ${o.usp}` : ""} ${
          o.is_default ? "(default)" : ""
        }`,
    )
    .join("\n");
}

function summarizeAudience(a: BrandAudience): string {
  const demo = Object.entries(a.demographics)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
  return [
    `이름: ${a.persona_name}`,
    `인구통계: ${demo || "(미상)"}`,
    `pains: ${a.pains.join(" / ")}`,
    `desires: ${a.desires.join(" / ")}`,
    a.language_level ? `언어: ${a.language_level}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateOfferDrafts(
  input: GenerateOffersInput,
): Promise<OfferDraftBatch> {
  const voice = input.identity?.voice_json ?? {};
  const taboos = input.identity?.taboos ?? [];

  const systemPrompt = `당신은 한국 디지털 광고의 시니어 카피라이터·CD입니다.
브랜드의 자산(브랜드 설명, 시설 사진 분석, 페르소나 정보, voice 가이드)을 바탕으로 ${input.count}개의 광고 오퍼 초안을 생성합니다.

규칙:
- 각 오퍼는 **다른 앵글**을 가져야 합니다 (예: 통증 직격 / 시간 강도 / 사회적 증거 / 희소성·정원제 / 가격 / 신뢰 등).
- title은 16자 이내 권장, USP는 40자 이내 권장.
- benefits는 검증 가능한 사실만. 키비주얼 description과 페르소나 desires에서 도출.
- evidence에는 수치·경력·인증 등 검증 가능한 신뢰 신호만. 없으면 빈 배열.
- urgency는 가짜 다급함 금지. 정원제·시즌 한정 등 사실 기반만.
- voice의 do/dont, taboos를 반드시 준수.
- 일반론 금지("최고", "1등", "유일", "100% 보장"). 페르소나 통증을 직접 언급할 것.
- 모든 출력은 한국어.
- 도구 ${OFFER_DRAFT_TOOL} 호출로만 결과 기록.`;

  const userText = `
[사용자 의도]
${input.intent}
${input.channel ? `[채널] ${input.channel}` : ""}

[브랜드]
이름: ${input.brand.name}
카테고리: ${input.brand.category ?? "(미상)"}
설명: ${input.brand.description ?? "(없음)"}
웹사이트: ${input.brand.website_url ?? "(없음)"}

[Voice]
tone: ${voice.tone ?? "(미상)"}
personality: ${(voice.personality ?? []).join(", ")}
do: ${(voice.do ?? []).join(" / ")}
dont: ${(voice.dont ?? []).join(" / ")}
taboos (절대 사용 금지): ${taboos.join(", ") || "(없음)"}

[페르소나 — 이 오퍼들의 1순위 타깃]
${summarizeAudience(input.audience)}

[키비주얼 인사이트 — 합성 단계 시각자산]
${summarizeKeyVisuals(input.keyVisuals)}

[기존 오퍼 — 중복 금지]
${summarizeExistingOffers(input.existingOffers)}

위 정보를 바탕으로 ${input.count}개의 오퍼 초안을 ${OFFER_DRAFT_TOOL}로 기록하세요.
각 오퍼는 다른 앵글이어야 하며, 페르소나의 pains·desires에 직접 대응해야 합니다.
기존 오퍼와 메시지·앵글이 겹치지 않도록 하세요.`;

  const response = await callClaude({
    usageContext: input.usageContext,
    model: "sonnet",
    maxTokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    tools: [offerDraftTool],
    toolChoice: { type: "tool", name: OFFER_DRAFT_TOOL },
  });

  const raw = extractToolUse(response, OFFER_DRAFT_TOOL);
  if (!raw) throw new Error("AI 초안 추출 실패");

  const parsed = OfferDraftBatchSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`초안 스키마 검증 실패: ${parsed.error.message}`);
  }

  return parsed.data;
}
