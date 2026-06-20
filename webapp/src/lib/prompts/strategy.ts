import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { Framework } from "@/lib/frameworks/types";
import type { FunnelGuide } from "@/lib/funnel/types";
import { buildVisionDigest, buildStrategyRoleHints, type DigestOpts } from "@/lib/vision/digest";
import { buildPreferenceDigest } from "@/lib/learning/digest";
import type { NoticeMeta } from "@/lib/campaigns/types";
import { formatNoticeMeta } from "@/lib/notice/extract";

export const STRATEGY_PROMPT_VERSION = "strategy@2.2.0";
export const STRATEGY_TOOL_NAME = "record_strategy_alternatives";

export type StrategyRole = "safe" | "explore" | "challenge";

// 샘플 카피. Strategy 단계에서 대안별로 1개씩 생성하여 사용자가
// Strategy 선택 화면에서 카피 샘플까지 한 번에 검토 가능하도록 한다.
// 별도 Copy 단계 없이도 이 샘플을 Visual로 바로 넘길 수 있음.
export const StrategySampleCopySchema = z.object({
  headline: z.string().min(1).max(40),
  subCopy: z.string().min(1).max(80),
  cta: z.string().min(1).max(15),
});
export type StrategySampleCopy = z.infer<typeof StrategySampleCopySchema>;

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
  sampleCopy: StrategySampleCopySchema,
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
            sampleCopy: {
              type: "object",
              description:
                "이 angle의 대표 카피 샘플 1개. 사용자가 별도 Copy 단계 없이도 바로 사용 가능한 완성도로 작성.",
              properties: {
                headline: {
                  type: "string",
                  description: "메인 헤드라인 (한국어, 공백 제외 12~18자 권장, 최대 40자)",
                },
                subCopy: {
                  type: "string",
                  description: "서브 카피 (20~35자 권장, 최대 80자)",
                },
                cta: {
                  type: "string",
                  description: "CTA 동사형 (3~8자)",
                },
              },
              required: ["headline", "subCopy", "cta"],
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
            "sampleCopy",
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
  // 안내문(notice) 모드: offer/audience 대신 원문+정보슬롯을 1급 소스로.
  isNotice?: boolean;
  rawContent?: string | null;
  noticeMeta?: NoticeMeta | null;
  toneOverride?: string | null;
}

function digestOpts(ctx: StrategyContext): DigestOpts {
  return { goal: ctx.funnel.stage, channel: ctx.channel };
}

export function buildStrategySystem(isNotice = false): string {
  if (isNotice) return buildNoticeStrategySystem();
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

## 샘플 카피 (각 대안에 1개 필수)
각 대안의 angle을 **사용자가 즉시 이해·채택 가능한 수준**의 완성형 카피로 하나씩 제시한다 (sampleCopy 필드).
- headline ≤40자 (선호 12~18자), subCopy ≤80자 (선호 20~35자), cta ≤15자 (선호 3~8자, 동사형)
- 수치·고유명사·행동 동사 중 하나 이상 포함
- 한국어 광고 톤 (번역체·격식체·AI 티 배제)
- Meta 정책: before/after 대조·개인 속성 단정·결과 확약 금지
- 해당 대안의 프레임워크(PAS/FAB/4U) 구조를 반영
- 실사 Key Visual이 선택됐다면 사진 여백 위에 얹힐 것을 전제로 짧고 임팩트 있게

## Preference 활용
- 참고 정보, 강제 반영 금지
- safe에서만 주로 반영 (100% 복제 지양)
- explore·challenge는 Preferences 무시하고 다양성 우선
- "자주 수정한 영역"은 visualDirection에 수치로 선제 명시

## Key Visual 활용 (실사 자산이 선택된 경우)
- visualDirection은 사진을 배경으로 전제한 **타이포·레이아웃·여백 전략**만 서술
- 피사체 재생성·재배치·보정 지시 절대 금지 (원본 픽셀 보존)
- 사진 mood·여백을 반영해 카피 위치·하이라이트 영역 제안
- 실사 미선택이면 이미지 모델 자유 생성 전제

한국어 출력. 도구 ${STRATEGY_TOOL_NAME}로만 기록.`;
}

function buildNoticeStrategySystem(): string {
  return `당신은 안내문/공지를 SNS 소재로 옮기는 크리에이티브 디렉터입니다. 안내문 소재 전략 대안 3개를 role별로 설계합니다.

## 안내문 모드 핵심 (설득형과 다름)
- 목적은 "설득·전환"이 아니라 **핵심 정보의 명확한 전달 + 신청/확인 행동 유도**.
- 원문에 있는 사실(정원·일정·대상·신청 경로·기입 요청)만 사용. 없는 혜택·수치 창작 금지.
- 과장·결과 확약·프리미엄 과시·감성 수사·불필요한 긴급성 연출 금지. 실제 마감(선착순 등)만 사실대로.
- tone_override 가 있으면 브랜드 Identity voice 보다 우선. 기본 톤은 사무적·정확·신뢰.

## 역할 분화 (필수)
- alt_1 safe: 가장 정공법. 핵심 정보(무엇을·누가·어떻게 신청)를 곧장 명확히
- alt_2 explore: 정보 위계를 달리한 각도(예: 정원/선착순을 앞세움 vs 대상 적합성을 앞세움)
- alt_3 challenge: 한 가지 핵심만 크게 거는 미니멀 정보 카드 각도
- 3대안 hookType·frameworkId 모두 서로 다름

## 스키마 사용 가이드 (정보 전달용으로 해석)
- hookType: 정보 성격에 맞게 number(정원·기간)·benefit(대상 적합성)·curiosity(요약 후 자세히) 중 선택
- frameworkId: 4U(특히 Useful·Urgent)를 기본 권장. 정보 명료성이 최우선
- angleName: 정보 전달 각도 이름
- keyMessage: 소재에 실릴 핵심 정보 한 줄
- visualDirection: **글자 없는 깔끔한 배경/정보 카드**를 전제로 한 톤·여백·구도만 서술 (텍스트는 합성 단계에서 오버레이됨)
- whyItWorks: 이 정보 위계가 왜 대상에게 명확/유용한지

## 샘플 카피 (각 대안 1개 필수, 사무적·명확)
- headline ≤40자: 핵심 정보를 곧장. 과장·감탄·물결표 금지
- subCopy ≤80자: 대상/정원/마감 등 보조 정보 또는 신청 안내
- cta ≤15자: "지금 신청", "신청서 작성", "자세히 보기" 등 행동 경로

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

function formatPlaybook(p: Playbook, isNotice = false): string {
  // Strategy 단계에선 hookTypes·recommended는 Funnel Guide가 담당.
  // 여기는 playbook 고유 정보만 최소 전달.
  if (isNotice) {
    // notice 모드: 설득형 톤·금기·비주얼 focus 주입 금지, 길이 구조만.
    return [
      "(안내문 모드 — 길이 구조만 적용. 설득형 톤·금기·비주얼 focus 미적용)",
      `headline: ≤${p.structure.headline.maxLen}자 (선호 ${p.structure.headline.preferredLen}자)`,
    ].join("\n");
  }
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
  if (ids.length === 0) return "(실사 자산 미선택 — 이미지 단계에서 이미지 모델 자유 생성)";
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
${formatPlaybook(ctx.playbook, ctx.isNotice)}

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

  const campaignBlock = ctx.isNotice
    ? `# 안내문 원문 (1급 소스 — 이 사실만 사용, 창작 금지)
${ctx.rawContent?.trim() || "(원문 없음)"}

# 정보 슬롯 (추출·검수됨)
${formatNoticeMeta(ctx.noticeMeta)}

# 톤 오버라이드
${ctx.toneOverride?.trim() || "(없음 — 사무적·명확 기본. Identity 프리미엄 voice 과용 금지)"}

# Intent Note
${ctx.intentNote ?? "(없음)"}

# Selected Key Visuals
${formatKeyVisuals(ctx)}${prev}${regen}

# TASK
안내문 소재 전략 3대안(safe/explore/challenge) 설계. 정보 명료성 최우선, 과장 금지. hookType·frameworkId 중복 금지. ${STRATEGY_TOOL_NAME}로 기록.`
    : `# Offer
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
