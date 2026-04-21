import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import { buildVisionDigest, buildStrategyRoleHints, type DigestOpts } from "@/lib/vision/digest";
import { buildPreferenceDigest } from "@/lib/learning/digest";

export const STRATEGY_PROMPT_VERSION = "strategy@2.0.0";
export const STRATEGY_TOOL_NAME = "record_strategy_alternatives";

export type StrategyRole = "safe" | "explore" | "challenge";

export const StrategyAlternativeSchema = z.object({
  id: z.string(),
  role: z.enum(["safe", "explore", "challenge"]),
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
  visualDirection: z.string().min(1).max(400),
  whyItWorks: z.string().min(1).max(400),
});
export type StrategyAlternative = z.infer<typeof StrategyAlternativeSchema>;

export const StrategyOutputSchema = z.object({
  alternatives: z.array(StrategyAlternativeSchema).length(3),
});
export type StrategyOutput = z.infer<typeof StrategyOutputSchema>;

export const strategyTool: Tool = {
  name: STRATEGY_TOOL_NAME,
  description: "BOFU 광고 소재용 전략 대안 3개 (safe / explore / challenge)",
  input_schema: {
    type: "object",
    properties: {
      alternatives: {
        type: "array",
        description: "서로 다른 역할·훅·프레임워크 조합 3개",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "alt_1 | alt_2 | alt_3" },
            role: {
              type: "string",
              enum: ["safe", "explore", "challenge"],
              description:
                "safe=검증된 방향, explore=새 각도, challenge=반대/도전 방향",
            },
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
              description:
                "비주얼 생성 단계에 전달할 디렉션 (구성·대상·숫자·대비). 최대 400자, 2~3문장 권장.",
            },
            whyItWorks: {
              type: "string",
              description:
                "페르소나의 pains·desires와 어떻게 연결되는지 근거. 최대 400자, 2~3문장 권장.",
            },
          },
          required: [
            "id",
            "role",
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
  channel: string;
  semanticBPDigest?: string | null;
  keyVisualIntent?: string | null;
  selectedKeyVisualIds?: string[];
  regenInstruction?: string;
  previousAngles?: Array<{
    angleName: string;
    hookType: string;
    frameworkId: string;
  }>;
}

function digestOpts(ctx: StrategyContext): DigestOpts {
  return { goal: ctx.funnel.stage, channel: ctx.channel };
}

export function buildStrategySystem(): string {
  return `당신은 퍼포먼스 광고 크리에이티브 디렉터입니다. 브랜드 자산을 바탕으로 BOFU(전환) 광고 소재의 전략 대안 3개를 **명확히 다른 역할**로 설계합니다.

역할 분화 (필수 · 아래 "Role-aware BP Guidance"와 "Semantic relevant BPs" 블록의 지시를 각 대안에 직접 적용):
- alt_1 role="safe": **지배 BP 패턴 + 의미 유사 BP 재현**. Guidance의 safe 항목과 Semantic Top-K 중 Rel#1의 hook/framework/mood/typography 조합을 적극 반영. 학습 데이터가 비면 플레이북 recommended hooks 중 가장 자연스러운 것.
- alt_2 role="explore": **BP 미등장·저빈도 영역 탐색**. Guidance의 explore 항목 + Semantic Top-K 중 유사도가 중간대(Rel#2~3)인 BP의 차별화 요소를 의도적으로 시도. safe와 완전히 다른 진입점.
- alt_3 role="challenge": **지배 패턴의 반대 축**. Guidance의 challenge 항목으로 가설을 뒤집는다. Semantic BP는 "피해야 할 안전지대" 신호로 해석. 플레이북 recommended 밖의 훅 사용도 OK.

원칙:
- 3대안의 hookType과 frameworkId는 모두 달라야 한다 (중복 금지).
- 각 대안은 타겟 페르소나의 pains/desires와 직접 연결되어야 한다.
- 플레이북의 taboos·금지 표현을 절대 사용하지 않는다.
- 수치·긴급성·구체적 혜택을 담는다. 추상적 수사·과장·before-after는 피한다.
- Brand Preferences는 **참고 정보일 뿐 강제 조건이 아니다**. safe에서만 주로 반영.
- 한국어로 출력. 도구 호출(${STRATEGY_TOOL_NAME})로만 결과를 기록.`;
}

function formatVisionDigest(ctx: StrategyContext): string {
  return buildVisionDigest(ctx.memory, digestOpts(ctx));
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

function formatKeyVisuals(ctx: StrategyContext): string {
  const ids = ctx.selectedKeyVisualIds ?? [];
  if (ids.length === 0) return "(실사 자산 미선택 — 이미지 단계에서 Gemini 자유 생성)";
  const pool = ctx.memory.keyVisuals ?? [];
  const selected = pool.filter((kv) => ids.includes(kv.id));
  if (selected.length === 0) return "(선택된 실사 자산을 찾을 수 없음)";
  const intent = ctx.keyVisualIntent
    ? `의도: "${ctx.keyVisualIntent}"\n`
    : "";
  const lines = selected.map((kv) => {
    const mood = kv.mood_tags?.length ? ` · mood: ${kv.mood_tags.join(", ")}` : "";
    const desc = kv.description ? ` · ${kv.description}` : "";
    return `  - [${kv.kind}] "${kv.label}"${desc}${mood}`;
  });
  return `${intent}${lines.join("\n")}`;
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

## Brand Patterns (BP Vision digest — ${ctx.funnel.stage} 관련성 재가중)
${formatVisionDigest(ctx)}

## Role-aware BP Guidance (3대안 차별화)
${buildStrategyRoleHints(ctx.memory, digestOpts(ctx))}

## Semantic relevant BPs (Top-K · Offer·Audience·Intent 의미 기반)
${ctx.semanticBPDigest ?? "(embedding 미활성 — 마이그레이션 013 적용 후 자동 수집)"}

## Selected Key Visuals (실제 브랜드 사진 — 최종 이미지에 사용됨)
${formatKeyVisuals(ctx)}

Key Visual 활용 규칙 (실사 자산이 선택된 경우):
- 각 대안의 visualDirection은 **주어진 실사 사진을 배경으로 전제**하고 그 위에 얹을 **타이포·레이아웃·여백 전략**만 서술한다.
- 피사체 재생성·재배치·보정 같은 지시는 절대 포함하지 않는다 (원본 사진은 픽셀 단위로 보존).
- 사진의 mood·여백을 읽어 카피 위치(상단/하단/좌측 블록)와 하이라이트할 영역을 제안한다.
- 실사 자산이 없으면 기존대로 Gemini가 장면을 자유 생성한다.

## Brand Preferences (이 브랜드의 과거 선택·평가)
${buildPreferenceDigest(ctx.memory)}

Preference 활용 규칙:
- Preferences는 **참고 정보**다. 강제 반영 금지.
- safe 대안에서만 주로 반영 — 그래도 100% 복제는 지양하고 조금은 새로운 요소 추가.
- explore·challenge는 Preferences에 **구애받지 않고** 다양성을 우선.
- "자주 수정한 영역"은 어느 대안이든 해당 요소를 선제적으로 명시 (예: retouch=size 빈번 → visualDirection에 수치 크기 구체화).
- 학습 데이터가 비어있으면 플레이북·BP 패턴만 참고.

# RULES

## Playbook — ${ctx.playbook.channel} / ${ctx.playbook.funnelStage}
${formatPlaybook(ctx.playbook)}

## Funnel Guide
${formatFunnel(ctx.funnel)}

## Available Frameworks
${formatFrameworks(ctx.frameworks)}

${
    ctx.previousAngles && ctx.previousAngles.length > 0
      ? `## Previous attempts (avoid duplicating these exact angles)
${ctx.previousAngles
  .map((p) => `  - "${p.angleName}" (${p.hookType} / ${p.frameworkId})`)
  .join("\n")}
`
      : ""
  }${
    ctx.regenInstruction
      ? `
## Re-generation direction (사용자 요청)
${ctx.regenInstruction}

이 방향성을 3대안 모두에 반영하되 역할 분화(safe/explore/challenge)는 유지.
`
      : ""
  }
# TASK
3대안을 **역할별로** 설계하세요:
- alt_1 (safe): 검증된 방향
- alt_2 (explore): 새로운 각도
- alt_3 (challenge): 반대·도전 방향

각 대안의 hookType과 frameworkId는 모두 서로 달라야 합니다. 후속 단계(Copy·Visual)에서 바로 확장될 수 있도록 구체적으로 작성하세요.
도구 ${STRATEGY_TOOL_NAME}로 결과를 기록하세요.`;

  return [
    {
      role: "user",
      content: [{ type: "text", text }],
    },
  ];
}
