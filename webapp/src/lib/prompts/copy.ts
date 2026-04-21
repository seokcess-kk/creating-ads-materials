import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import type { StrategyAlternative } from "./strategy";
import { buildCopyPatternDigest, buildVisionDigest } from "@/lib/vision/digest";
import { buildPreferenceDigest } from "@/lib/learning/digest";

export const COPY_PROMPT_VERSION = "copy@1.0.0";
export const COPY_TOOL_NAME = "record_copy_drafts";

export const CopyVariantSchema = z.object({
  id: z.string(),
  headline: z.string().min(1).max(40),
  subCopy: z.string().min(1).max(80),
  cta: z.string().min(1).max(15),
  rationale: z.string().min(1).max(200),
});
export type CopyVariant = z.infer<typeof CopyVariantSchema>;

export const CopyCritiqueSchema = z.object({
  variantId: z.string(),
  scores: z.object({
    taboosClear: z.number().min(1).max(5),
    frameworkFit: z.number().min(1).max(5),
    hookStrength: z.number().min(1).max(5),
    koreanNatural: z.number().min(1).max(5),
    overall: z.number().min(1).max(5),
  }),
  issues: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});
export type CopyCritique = z.infer<typeof CopyCritiqueSchema>;

export const CopyOutputSchema = z.object({
  variants: z.array(CopyVariantSchema).min(5).max(8),
  critiques: z.array(CopyCritiqueSchema),
});
export type CopyOutput = z.infer<typeof CopyOutputSchema>;

export const copyTool: Tool = {
  name: COPY_TOOL_NAME,
  description: "5~8개 카피 변형 + 표준 self-critique 결과를 함께 기록",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        description: "선택된 전략 angle 안에서의 카피 변형. 서로 다른 뉘앙스·시작점·핵심 단어.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "copy_1 ~ copy_8" },
            headline: {
              type: "string",
              description: "메인 헤드라인 (한국어, 공백 제외 12~18자 권장, 최대 40자)",
            },
            subCopy: {
              type: "string",
              description: "서브 카피 (헤드라인 보완, 20~35자 권장, 최대 80자)",
            },
            cta: {
              type: "string",
              description: "CTA 동사형 (3~8자, 예: '지금 신청', '받아보기')",
            },
            rationale: {
              type: "string",
              description: "이 변형이 어떤 각도에서 hook을 만드는지 한 줄 근거",
            },
          },
          required: ["id", "headline", "subCopy", "cta", "rationale"],
        },
      },
      critiques: {
        type: "array",
        description: "각 변형에 대한 표준 self-critique (4축 + 종합)",
        items: {
          type: "object",
          properties: {
            variantId: { type: "string" },
            scores: {
              type: "object",
              properties: {
                taboosClear: {
                  type: "number",
                  description:
                    "1~5: 플레이북 taboos·Identity taboos·Meta 정책 위반 없음",
                },
                frameworkFit: {
                  type: "number",
                  description: "1~5: 선택된 프레임워크 구조 충실도",
                },
                hookStrength: {
                  type: "number",
                  description: "1~5: 첫 3초 주목도·스크롤 멈춤 강도",
                },
                koreanNatural: {
                  type: "number",
                  description: "1~5: 번역체/격식체 없이 광고 톤 자연스러움",
                },
                overall: { type: "number", description: "1~5: 4축 평균" },
              },
              required: [
                "taboosClear",
                "frameworkFit",
                "hookStrength",
                "koreanNatural",
                "overall",
              ],
            },
            issues: {
              type: "array",
              items: { type: "string" },
              description: "감지된 문제점",
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "구체적 개선안",
            },
          },
          required: ["variantId", "scores"],
        },
      },
    },
    required: ["variants", "critiques"],
  },
};

export interface CopyContext {
  memory: BrandMemory;
  offerId: string | null;
  audienceId: string | null;
  intentNote: string | null;
  strategy: StrategyAlternative;
  playbook: Playbook;
  framework: Framework;
  funnel: FunnelGuide;
}

export function buildCopySystem(): string {
  return `당신은 퍼포먼스 광고 시니어 카피라이터입니다. 선택된 전략을 기반으로 5~8개의 카피 변형을 작성하고, 각 변형을 4축으로 자체 평가합니다.

카피 작성 원칙:
- 선택된 전략(angle)의 프레임워크 구조를 충실히 따른다.
- 5~8개 변형은 서로 다른 진입점을 사용한다: 혜택 중심 / 증거 중심 / 시간 중심 / 페인 중심 / 긴급성 중심 등.
- 단순 단어 교체 금지. 의미·뉘앙스가 달라야 한다.
- Identity taboos + 플레이북 taboos를 절대 사용하지 않는다.
- Meta 광고 정책 위반 금지: before/after 대조, 개인 속성 단정 지칭, 결과 확약.
- 한국어 광고 톤. 번역체·격식체·AI 티 배제.
- 헤드라인에 수치·고유명사·행동 동사 중 하나 이상 포함.

Self-critique 원칙(4축, 1~5점):
- taboosClear: taboo·정책 위반 여부 (5=전혀 없음, 1=심각 위반)
- frameworkFit: 선택된 프레임워크 구조 충실도
- hookStrength: 스크롤 멈출 확률. 수치·구체성·대비가 있을수록 높음
- koreanNatural: 번역체·AI 티 여부 (5=자연스러운 광고 톤, 1=어색)
- overall은 4축의 산술 평균.

도구 ${COPY_TOOL_NAME}로 variants·critiques를 한 번에 기록하세요.`;
}

function formatIdentity(memory: BrandMemory): string {
  const id = memory.identity;
  if (!id) return "(Identity 미설정)";
  const voice = id.voice_json;
  const lines: string[] = [];
  if (voice.tone) lines.push(`- tone: ${voice.tone}`);
  if (voice.do?.length) lines.push(`- do: ${voice.do.join(", ")}`);
  if (voice.dont?.length) lines.push(`- dont: ${voice.dont.join(", ")}`);
  if (id.taboos.length) lines.push(`- identity-taboos: ${id.taboos.join(", ")}`);
  return lines.join("\n");
}

function formatOffer(ctx: CopyContext): string {
  const offer =
    ctx.memory.offers.find((o) => o.id === ctx.offerId) ?? ctx.memory.offers[0];
  if (!offer) return "(Offer 없음)";
  const lines = [`- title: ${offer.title}`];
  if (offer.usp) lines.push(`- USP: ${offer.usp}`);
  if (offer.price) lines.push(`- price: ${offer.price}`);
  if (offer.benefits.length) lines.push(`- benefits: ${offer.benefits.join(" · ")}`);
  if (offer.urgency) lines.push(`- urgency: ${offer.urgency}`);
  if (offer.evidence.length) lines.push(`- evidence: ${offer.evidence.join(" · ")}`);
  return lines.join("\n");
}

function formatAudience(ctx: CopyContext): string {
  const a =
    ctx.memory.audiences.find((x) => x.id === ctx.audienceId) ??
    ctx.memory.audiences[0];
  if (!a) return "(Audience 없음)";
  const lines = [`- persona: ${a.persona_name}`];
  if (a.pains.length) lines.push(`- pains: ${a.pains.join(" · ")}`);
  if (a.desires.length) lines.push(`- desires: ${a.desires.join(" · ")}`);
  return lines.join("\n");
}

function formatStrategy(s: StrategyAlternative): string {
  return [
    `- angleName: ${s.angleName}`,
    `- hookType: ${s.hookType}`,
    `- framework: ${s.frameworkId}`,
    `- angleSummary: ${s.angleSummary}`,
    `- keyMessage: ${s.keyMessage}`,
    `- whyItWorks: ${s.whyItWorks}`,
  ].join("\n");
}

function formatPlaybook(p: Playbook): string {
  return [
    `version: ${p.version}`,
    `tone: ${p.tone.style}`,
    `do: ${p.tone.do.join(" · ")}`,
    `dont: ${p.tone.dont.join(" · ")}`,
    `playbook-taboos: ${p.taboos.join(", ")}`,
    `headline: ${p.structure.headline.maxLen}자 이내, 선호 ${p.structure.headline.preferredLen}자`,
    `sub: ${p.structure.subCopy.maxLen}자 이내, 선호 ${p.structure.subCopy.preferredLen}자`,
    `cta: ${p.structure.cta.maxLen}자 이내, 선호 ${p.structure.cta.preferredLen}자 / 동사형`,
    `cta verbs: ${p.cta.verbs.join(" · ")}`,
    `hashtags: ${p.hashtagsUse ? "사용" : "미사용"}`,
  ].join("\n");
}

function formatFramework(f: Framework): string {
  const parts = f.structure
    .map((s) => `  - ${s.role}: ${s.description}${s.charLimit ? ` (≤${s.charLimit}자)` : ""}`)
    .join("\n");
  return `${f.id} — ${f.name}\n${f.summary}\n구조:\n${parts}\n힌트: ${f.promptHint}`;
}

function formatFunnel(g: FunnelGuide): string {
  return [
    `stage: ${g.stage}`,
    `primary: ${g.messaging.primary}`,
    `tone: ${g.messaging.tone}`,
    `cta: ${g.messaging.cta}`,
  ].join("\n");
}

export function buildCopyMessages(ctx: CopyContext): MessageParam[] {
  const text = `# CONTEXT

## Brand
- name: ${ctx.memory.brand.name}
- category: ${ctx.memory.brand.category ?? "(미지정)"}

## Identity
${formatIdentity(ctx.memory)}

## Offer (선택)
${formatOffer(ctx)}

## Audience (선택)
${formatAudience(ctx)}

## Intent Note
${ctx.intentNote ?? "(없음)"}

## Selected Strategy
${formatStrategy(ctx.strategy)}

## Brand Patterns (BP Copy digest)
${buildCopyPatternDigest(ctx.memory)}

## Brand Patterns (BP Vision digest)
${buildVisionDigest(ctx.memory, 3)}

## Brand Preferences (과거 선택·평가)
${buildPreferenceDigest(ctx.memory)}
(5~8개 변형은 진입점을 다양하게 유지하되, 선호 훅과 "자주 수정한 영역"을 의식적으로 반영)

# RULES

## Playbook
${formatPlaybook(ctx.playbook)}

## Framework (선택된 전략 기준)
${formatFramework(ctx.framework)}

## Funnel Guide
${formatFunnel(ctx.funnel)}

# TASK
선택된 전략의 각도 안에서, 서로 다른 진입점을 사용한 카피 변형 5~8개를 작성하고 각각을 self-critique 하세요.
도구 ${COPY_TOOL_NAME}로 variants·critiques를 한 번에 기록하세요.`;

  return [
    {
      role: "user",
      content: [{ type: "text", text }],
    },
  ];
}
