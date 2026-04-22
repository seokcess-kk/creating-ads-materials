import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import { buildVisionDigest, buildStrategyRoleHints, type DigestOpts } from "@/lib/vision/digest";
import { buildPreferenceDigest } from "@/lib/learning/digest";

export const STRATEGY_PROMPT_VERSION = "strategy@2.1.0";
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
  return `당신은 퍼포먼스 광고 크리에이티브 디렉터입니다. BOFU 광고 전략 대안 3개를 role별로 설계합니다.

## 역할 분화 (필수)
- alt_1 safe: 지배 BP 패턴 + Semantic Rel#1 재현. 학습 데이터 부재 시 플레이북 recommended hooks 우선
- alt_2 explore: BP 미등장·저빈도 영역 탐색. Semantic Rel#2~3의 차별화 요소 시도. safe와 완전 다른 진입점
- alt_3 challenge: 지배 패턴의 반대 축. Semantic BP는 "피할 안전지대"로 해석. recommended 밖 훅 허용

## 원칙
- 3대안 hookType·frameworkId 모두 서로 다름 (중복 금지)
- 각 대안은 페르소나 pains/desires와 직접 연결
- 플레이북 taboos + Identity taboos 절대 금지
- 수치·긴급성·구체 혜택. 추상 수사·과장·before-after 금지

## Preference 활용
- 참고 정보, 강제 반영 금지
- safe에서만 주로 반영 (100% 복제 지양)
- explore·challenge는 Preferences 무시하고 다양성 우선
- "자주 수정한 영역"은 visualDirection에 수치로 선제 명시

## Key Visual 활용 (실사 자산이 선택된 경우)
- visualDirection은 사진을 배경으로 전제한 **타이포·레이아웃·여백 전략**만 서술
- 피사체 재생성·재배치·보정 지시 절대 금지 (원본 픽셀 보존)
- 사진 mood·여백을 반영해 카피 위치·하이라이트 영역 제안
- 실사 미선택이면 Gemini 자유 생성 전제

한국어 출력. 도구 ${STRATEGY_TOOL_NAME}로만 기록.`;
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
  // Strategy 단계에선 hookTypes·recommended는 Funnel Guide가 담당.
  // 여기는 playbook 고유 정보만 최소 전달.
  return [
    `tone: ${p.tone.style} · do: ${p.tone.do.join(" · ")} · dont: ${p.tone.dont.join(" · ")}`,
    `taboos: ${p.taboos.join(", ")}`,
    `headline: ≤${p.structure.headline.maxLen}자 (선호 ${p.structure.headline.preferredLen}자)`,
    `visual focus: ${p.visualGuide.focus.join(" · ")} / avoid: ${p.visualGuide.avoid.join(" · ")}`,
  ].join("\n");
}

function formatFrameworks(fs: Framework[]): string {
  // Strategy 단계에서는 framework 선택만 결정. 상세 구조는 Copy 단계에서 선택된 하나만 전송.
  return fs.map((f) => `- ${f.id}: ${f.name} — ${f.summary}`).join("\n");
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
  // Brand-level (cache 대상): 같은 브랜드 + 같은 channel/funnel 조합에서 재사용되는 블록.
  // 채널·funnel이 바뀌면 cache miss가 나지만, 한 캠페인 세션 내 Strategy 반복·재시도는 hit.
  const brandBlock = `# Brand
- name: ${ctx.memory.brand.name} / category: ${ctx.memory.brand.category ?? "(미지정)"}
${ctx.memory.brand.description ? `- ${ctx.memory.brand.description}` : ""}

# Identity
${formatIdentity(ctx.memory)}

# BP Vision digest (${ctx.funnel.stage} 재가중)
${formatVisionDigest(ctx)}

# Role-aware BP Guidance
${buildStrategyRoleHints(ctx.memory, digestOpts(ctx))}

# Brand Preferences
${buildPreferenceDigest(ctx.memory)}

# Playbook (${ctx.playbook.channel} / ${ctx.playbook.funnelStage})
${formatPlaybook(ctx.playbook)}

# Funnel Guide
${formatFunnel(ctx.funnel)}

# Available Frameworks
${formatFrameworks(ctx.frameworks)}`;

  // Campaign-level: 캠페인마다 달라지는 변수부. cache 안 함.
  const prev =
    ctx.previousAngles && ctx.previousAngles.length > 0
      ? `\n\n# Previous attempts (중복 금지)\n${ctx.previousAngles
          .map((p) => `- "${p.angleName}" (${p.hookType}/${p.frameworkId})`)
          .join("\n")}`
      : "";
  const regen = ctx.regenInstruction
    ? `\n\n# Re-generation direction\n${ctx.regenInstruction}\n(3대안 모두 반영, 역할 분화 유지)`
    : "";

  const campaignBlock = `# Offer
${formatOffer(ctx)}

# Audience
${formatAudience(ctx)}

# Intent Note
${ctx.intentNote ?? "(없음)"}

# Semantic relevant BPs
${ctx.semanticBPDigest ?? "(embedding 미활성)"}

# Selected Key Visuals
${formatKeyVisuals(ctx)}${prev}${regen}

# TASK
역할별 3대안(safe/explore/challenge) 설계. hookType·frameworkId 중복 금지. ${STRATEGY_TOOL_NAME}로 기록.`;

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
