import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import { buildVisionDigest } from "@/lib/vision/digest";

export const STRATEGY_PROMPT_VERSION = "strategy@1.0.0";
export const STRATEGY_TOOL_NAME = "record_strategy_alternatives";

export const StrategyAlternativeSchema = z.object({
  id: z.string(),
  hookType: z.enum([
    "empathy",
    "problem",
    "insight",
    "emotion",
    "curiosity",
    "number",
    "benefit",
    "urgency",
  ]),
  frameworkId: z.enum(["PAS", "FAB", "4U"]),
  angleName: z.string().min(1).max(40),
  angleSummary: z.string().min(1).max(160),
  keyMessage: z.string().min(1).max(100),
  visualDirection: z.string().min(1).max(200),
  whyItWorks: z.string().min(1).max(200),
});
export type StrategyAlternative = z.infer<typeof StrategyAlternativeSchema>;

export const StrategyOutputSchema = z.object({
  alternatives: z.array(StrategyAlternativeSchema).length(3),
});
export type StrategyOutput = z.infer<typeof StrategyOutputSchema>;

export const strategyTool: Tool = {
  name: STRATEGY_TOOL_NAME,
  description: "BOFU 광고 소재용 전략 대안 3개를 구조화하여 기록",
  input_schema: {
    type: "object",
    properties: {
      alternatives: {
        type: "array",
        description: "서로 다른 훅×프레임워크 조합 3개",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "alt_1 | alt_2 | alt_3" },
            hookType: {
              type: "string",
              enum: [
                "empathy",
                "problem",
                "insight",
                "emotion",
                "curiosity",
                "number",
                "benefit",
                "urgency",
              ],
              description: "첫 문장 훅의 심리 자극 유형",
            },
            frameworkId: {
              type: "string",
              enum: ["PAS", "FAB", "4U"],
              description: "카피 구조 프레임워크",
            },
            angleName: {
              type: "string",
              description: "대안의 한 줄 이름 (예: '절약 시간 강조')",
            },
            angleSummary: {
              type: "string",
              description: "이 각도의 핵심 아이디어 1~2문장",
            },
            keyMessage: {
              type: "string",
              description: "카피 작성 단계에서 중심이 될 핵심 메시지",
            },
            visualDirection: {
              type: "string",
              description: "비주얼 생성 단계에 전달할 디렉션 (구성·대상·숫자·대비)",
            },
            whyItWorks: {
              type: "string",
              description: "페르소나의 pains·desires와 어떻게 연결되는지 근거",
            },
          },
          required: [
            "id",
            "hookType",
            "frameworkId",
            "angleName",
            "angleSummary",
            "keyMessage",
            "visualDirection",
            "whyItWorks",
          ],
        },
      },
    },
    required: ["alternatives"],
  },
};

export interface StrategyContext {
  memory: BrandMemory;
  offerId: string | null;
  audienceId: string | null;
  intentNote: string | null;
  playbook: Playbook;
  frameworks: Framework[];
  funnel: FunnelGuide;
}

export function buildStrategySystem(): string {
  return `당신은 퍼포먼스 광고 크리에이티브 디렉터입니다. 브랜드 자산을 바탕으로 BOFU(전환) 광고 소재의 전략 대안 3개를 설계합니다.

원칙:
- 3대안은 서로 다른 훅 타입 × 프레임워크 조합이어야 한다 (중복 금지).
- 각 대안은 타겟 페르소나의 pains/desires와 직접 연결되어야 한다.
- 플레이북의 taboos·금지 표현을 절대 사용하지 않는다.
- 수치·긴급성·구체적 혜택을 담는다. 추상적 수사·과장·before-after는 피한다.
- 각 대안은 카피(헤드·서브·CTA)와 비주얼을 둘 다 설계할 수 있을 만큼 구체적이어야 한다.
- 한국어로 출력. 도구 호출(${STRATEGY_TOOL_NAME})로만 결과를 기록.`;
}

function formatVisionDigest(memory: BrandMemory): string {
  return buildVisionDigest(memory);
}

function formatIdentity(memory: BrandMemory): string {
  const id = memory.identity;
  if (!id) return "(Identity 미설정)";
  const voice = id.voice_json;
  const lines: string[] = [];
  if (voice.tone) lines.push(`- tone: ${voice.tone}`);
  if (voice.personality?.length) lines.push(`- personality: ${voice.personality.join(", ")}`);
  if (voice.do?.length) lines.push(`- do: ${voice.do.join(", ")}`);
  if (voice.dont?.length) lines.push(`- dont: ${voice.dont.join(", ")}`);
  if (id.taboos.length) lines.push(`- taboos: ${id.taboos.join(", ")}`);
  if (id.colors_json.length) {
    lines.push(`- colors: ${id.colors_json.map((c) => `${c.role}=${c.hex}`).join(", ")}`);
  }
  return lines.join("\n") || "(빈 Identity)";
}

function formatOffer(ctx: StrategyContext): string {
  const offer = ctx.memory.offers.find((o) => o.id === ctx.offerId) ?? ctx.memory.offers[0];
  if (!offer) return "(Offer 없음)";
  const lines = [`- title: ${offer.title}`];
  if (offer.usp) lines.push(`- USP: ${offer.usp}`);
  if (offer.price) lines.push(`- price: ${offer.price}`);
  if (offer.benefits.length) lines.push(`- benefits: ${offer.benefits.join(" · ")}`);
  if (offer.urgency) lines.push(`- urgency: ${offer.urgency}`);
  if (offer.evidence.length) lines.push(`- evidence: ${offer.evidence.join(" · ")}`);
  return lines.join("\n");
}

function formatAudience(ctx: StrategyContext): string {
  const a =
    ctx.memory.audiences.find((x) => x.id === ctx.audienceId) ?? ctx.memory.audiences[0];
  if (!a) return "(Audience 없음)";
  const d = a.demographics as Record<string, string>;
  const demo = [d.age, d.gender, d.region, d.income].filter(Boolean).join(" · ");
  const lines = [`- persona: ${a.persona_name}`];
  if (demo) lines.push(`- demographics: ${demo}`);
  if (a.language_level) lines.push(`- languageLevel: ${a.language_level}`);
  if (a.pains.length) lines.push(`- pains: ${a.pains.join(" · ")}`);
  if (a.desires.length) lines.push(`- desires: ${a.desires.join(" · ")}`);
  if (a.notes) lines.push(`- notes: ${a.notes}`);
  return lines.join("\n");
}

function formatPlaybook(p: Playbook): string {
  return [
    `version: ${p.version}`,
    `hookTypes available: ${p.hookTypes.join(", ")}`,
    `recommended: ${p.recommendedHooks.join(", ")}`,
    `tone: ${p.tone.style}`,
    `do: ${p.tone.do.join(" · ")}`,
    `dont: ${p.tone.dont.join(" · ")}`,
    `taboos: ${p.taboos.join(", ")}`,
    `headline maxLen: ${p.structure.headline.maxLen}자, preferred ${p.structure.headline.preferredLen}자`,
    `visual focus: ${p.visualGuide.focus.join(" · ")}`,
    `visual avoid: ${p.visualGuide.avoid.join(" · ")}`,
    `colorStrategy: ${p.visualGuide.colorStrategy}`,
  ].join("\n");
}

function formatFrameworks(fs: Framework[]): string {
  return fs
    .map(
      (f) =>
        `### ${f.id} — ${f.name}\n${f.summary}\n구조: ${f.structure.map((s) => s.role).join(" → ")}\n힌트: ${f.promptHint}`,
    )
    .join("\n\n");
}

function formatFunnel(g: FunnelGuide): string {
  return [
    `stage: ${g.stage}`,
    `goal: ${g.goal}`,
    `tone: ${g.messaging.tone}`,
    `cta: ${g.messaging.cta}`,
    `recommended hooks: ${g.recommendedHooks.join(", ")}`,
    `avoid: ${g.avoid.join(" · ")}`,
  ].join("\n");
}

export function buildStrategyMessages(ctx: StrategyContext): MessageParam[] {
  const text = `# CONTEXT

## Brand
- name: ${ctx.memory.brand.name}
- category: ${ctx.memory.brand.category ?? "(미지정)"}
- website: ${ctx.memory.brand.website_url ?? "(없음)"}
- description: ${ctx.memory.brand.description ?? "(없음)"}

## Identity
${formatIdentity(ctx.memory)}

## Offer (선택된)
${formatOffer(ctx)}

## Audience (선택된)
${formatAudience(ctx)}

## Intent Note
${ctx.intentNote ?? "(없음)"}

## Brand Patterns (BP Vision digest)
${formatVisionDigest(ctx.memory)}

# RULES

## Playbook — ${ctx.playbook.channel} / ${ctx.playbook.funnelStage}
${formatPlaybook(ctx.playbook)}

## Funnel Guide
${formatFunnel(ctx.funnel)}

## Available Frameworks
${formatFrameworks(ctx.frameworks)}

# TASK
서로 다른 훅 타입 × 프레임워크 조합으로 전략 대안 3개를 설계하세요. 각 대안은 후속 단계(Copy·Visual)에서 바로 확장될 수 있어야 합니다.
도구 ${STRATEGY_TOOL_NAME}로 결과를 기록하세요.`;

  return [
    {
      role: "user",
      content: [{ type: "text", text }],
    },
  ];
}
