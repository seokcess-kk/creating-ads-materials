import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import type { StrategyAlternative } from "./strategy";
import { buildCopyPatternDigest, type DigestOpts } from "@/lib/vision/digest";
import { buildPreferenceDigest } from "@/lib/learning/digest";

export const COPY_PROMPT_VERSION = "copy@1.2.0";
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
  variants: z.array(CopyVariantSchema).min(5).max(6),
  critiques: z.array(CopyCritiqueSchema),
});
export type CopyOutput = z.infer<typeof CopyOutputSchema>;

export const copyTool: Tool = {
  name: COPY_TOOL_NAME,
  description: "5~6개 카피 변형 + 표준 self-critique 결과를 함께 기록",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: 5,
        maxItems: 6,
        description: "선택된 전략 angle 안에서의 카피 변형. 서로 다른 뉘앙스·시작점·핵심 단어.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "copy_1 ~ copy_6" },
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
  channel: string;
  semanticBPDigest?: string | null;
  keyVisualIntent?: string | null;
  selectedKeyVisualIds?: string[];
  regenInstruction?: string;
  previousHeadlines?: string[];
}

function copyDigestOpts(ctx: CopyContext): DigestOpts {
  return { goal: ctx.funnel.stage, channel: ctx.channel };
}

export function buildCopySystem(): string {
  return `당신은 퍼포먼스 광고 시니어 카피라이터입니다. 선택된 전략 기반 카피 5~6개 변형 + 각 변형 4축 self-critique.

## 작성 원칙
- 전략 angle의 프레임워크 구조 충실
- 5~6개는 서로 다른 진입점 (혜택/증거/시간/페인/긴급성 등)
- 단순 단어 교체 금지 — 의미·뉘앙스 달라야 함
- Identity taboos + 플레이북 taboos 절대 금지
- Meta 정책 금지: before/after 대조, 개인 속성 단정, 결과 확약
- 한국어 광고 톤 (번역체·격식체·AI 티 배제)
- 헤드라인에 수치·고유명사·행동 동사 중 하나 이상

## Self-critique (1~5점)
- taboosClear: taboo·정책 위반 (5=없음, 1=심각)
- frameworkFit: 프레임워크 충실도
- hookStrength: 3초 주목도 (수치·구체성·대비가 있을수록 높음)
- koreanNatural: 번역체·AI 티 (5=자연, 1=어색)
- overall: 4축 평균

## Key Visual 활용 (실사 자산이 선택된 경우)
- 사진 여백에 얹힐 전제로 짧고 임팩트 있는 헤드라인 선호
- 사진 mood(warm/clean/professional 등)와 일치하는 톤 선택

## Brand Preferences 활용
- 참고 정보, 강제 반영 금지
- 선호 훅·"자주 수정한 영역"을 의식적으로 반영하되 진입점은 다양화

도구 ${COPY_TOOL_NAME}로 variants + critiques 한 번에 기록.`;
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

function formatKeyVisuals(ctx: CopyContext): string {
  const ids = ctx.selectedKeyVisualIds ?? [];
  if (ids.length === 0) return "(실사 자산 미선택)";
  const pool = ctx.memory.keyVisuals ?? [];
  const selected = pool.filter((kv) => ids.includes(kv.id));
  if (selected.length === 0) return "(선택된 실사 자산을 찾을 수 없음)";
  const intent = ctx.keyVisualIntent ? `의도: "${ctx.keyVisualIntent}"\n` : "";
  const lines = selected.map((kv) => {
    const mood = kv.mood_tags?.length ? ` · mood: ${kv.mood_tags.join(", ")}` : "";
    const desc = kv.description ? ` · ${kv.description}` : "";
    return `  - [${kv.kind}] "${kv.label}"${desc}${mood}`;
  });
  return `${intent}${lines.join("\n")}`;
}

export function buildCopyMessages(ctx: CopyContext): MessageParam[] {
  // Brand-level (cache 대상). 채널/funnel이 같은 브랜드 반복 호출 시 재사용.
  // framework·playbook도 brand block에 포함: framework는 strategy가 선택한 하나라
  // 캠페인 내 재생성 시 재사용 가능, playbook은 channel+goal 단위 고정.
  const brandBlock = `# Brand
- ${ctx.memory.brand.name} / ${ctx.memory.brand.category ?? "(미지정)"}

# Identity
${formatIdentity(ctx.memory)}

# BP Copy digest (${ctx.funnel.stage} 재가중, Top-3)
${buildCopyPatternDigest(ctx.memory, copyDigestOpts(ctx))}

# Brand Preferences
${buildPreferenceDigest(ctx.memory)}

# Playbook
${formatPlaybook(ctx.playbook)}

# Funnel Guide
${formatFunnel(ctx.funnel)}`;

  const prev =
    ctx.previousHeadlines && ctx.previousHeadlines.length > 0
      ? `\n\n# Previous headlines (중복 금지)\n${ctx.previousHeadlines.map((h) => `- "${h}"`).join("\n")}`
      : "";
  const regen = ctx.regenInstruction
    ? `\n\n# Re-generation direction\n${ctx.regenInstruction}\n(전체 변형에 반영, 진입점 다양성 유지)`
    : "";

  // Campaign-level: 캠페인·전략별로 달라지는 부분.
  const campaignBlock = `# Offer
${formatOffer(ctx)}

# Audience
${formatAudience(ctx)}

# Intent Note
${ctx.intentNote ?? "(없음)"}

# Selected Strategy
${formatStrategy(ctx.strategy)}

# Semantic relevant BPs
${ctx.semanticBPDigest ?? "(embedding 미활성)"}

# Selected Key Visuals
${formatKeyVisuals(ctx)}

# Framework (선택됨)
${formatFramework(ctx.framework)}${prev}${regen}

# TASK
전략 angle 안에서 서로 다른 진입점으로 5~6개 카피 + 각 self-critique. ${COPY_TOOL_NAME}로 기록.`;

  return [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: brandBlock,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: campaignBlock },
      ],
    },
  ];
}
