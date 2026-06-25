import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { NoticeMeta } from "@/lib/notice/types";
import { formatNoticeMeta } from "@/lib/notice/extract";
import { TEMPLATE_IDS, DEFAULT_TEMPLATE_ID } from "./templates";

export const CAROUSEL_PROMPT_VERSION = "carousel@0.1.0";
export const CONCEPT_TOOL_NAME = "record_bundle_concept";
export const SLIDES_TOOL_NAME = "record_slide_details";

export const MIN_SLIDES = 4;
export const MAX_SLIDES = 8;

// ── 1단계: 번들 기획(콘셉트/서사) ──────────────────────────────
const SlidePlanItemSchema = z.object({
  index: z.number().int().min(1),
  role: z.enum(["hook", "point", "cta"]),
  purpose: z.string().min(1).max(60),
});

export const BundleConceptSchema = z.object({
  title: z.string().min(1).max(40),
  bigIdea: z.string().min(1).max(80),
  coreMessage: z.string().min(1).max(140),
  target: z.string().max(80),
  tone: z.string().max(60),
  narrativeArc: z.string().max(240),
  slideCount: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES),
  slidePlan: z.array(SlidePlanItemSchema).min(MIN_SLIDES).max(MAX_SLIDES),
  // 비주얼 템플릿(없는 구 데이터는 기본값으로 폴백).
  template: z.enum(TEMPLATE_IDS).default(DEFAULT_TEMPLATE_ID),
});

export const conceptTool: Tool = {
  name: CONCEPT_TOOL_NAME,
  description:
    "원문을 캐러셀 한 묶음의 '기획'으로 설계. 슬라이드별 상세 카피가 아니라, 전체 콘셉트/핵심메시지/타겟/톤/서사 흐름과 각 슬라이드의 역할(목적)만 잡는다.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "캐러셀 전체 주제(내부 식별용, 40자 이내)" },
      bigIdea: { type: "string", description: "캐러셀을 관통하는 한 줄 콘셉트(80자 이내)" },
      coreMessage: {
        type: "string",
        description: "독자가 끝까지 보고 가져갈 단 하나의 핵심 메시지(140자 이내)",
      },
      target: { type: "string", description: "누구에게 말하는가(타겟 한 줄)" },
      tone: { type: "string", description: "톤앤매너 한 줄" },
      narrativeArc: {
        type: "string",
        description:
          "슬라이드를 관통하는 서사 흐름 한 문단(예: 훅 → 문제/근거 → 해법/혜택 → 행동). 240자 이내",
      },
      slideCount: {
        type: "number",
        description: `콘텐츠 양에 맞는 권장 슬라이드 수 (${MIN_SLIDES}~${MAX_SLIDES})`,
      },
      template: {
        type: "string",
        enum: [...TEMPLATE_IDS],
        description:
          "톤·주제에 가장 맞는 비주얼 템플릿 1개. midnight=신뢰·차분 다크블루(정보/공지/B2B) / noir=프리미엄·에디토리얼 블랙&골드(럭셔리/브랜딩) / vivid=에너지·모던 비비드 컬러(프로모션/MZ).",
      },
      slidePlan: {
        type: "array",
        minItems: MIN_SLIDES,
        maxItems: MAX_SLIDES,
        description: "각 슬라이드의 역할/목적 한 줄(상세 카피 아님). 순서대로.",
        items: {
          type: "object",
          properties: {
            index: { type: "number", description: "1부터 시작" },
            role: {
              type: "string",
              enum: ["hook", "point", "cta"],
              description: "hook=1번 훅 / point=핵심 / cta=마지막 행동 유도",
            },
            purpose: {
              type: "string",
              description: "이 슬라이드가 책임지는 역할 한 줄(50자 이내)",
            },
          },
          required: ["index", "role", "purpose"],
        },
      },
    },
    required: [
      "title",
      "bigIdea",
      "coreMessage",
      "target",
      "tone",
      "narrativeArc",
      "slideCount",
      "template",
      "slidePlan",
    ],
  },
};

// ── 2단계: 슬라이드 상세(카피 + 비주얼 디렉션) ─────────────────
const SlideDetailSchema = z.object({
  index: z.number().int().min(1),
  role: z.enum(["hook", "point", "cta"]),
  kicker: z.string().max(24).optional(),
  headline: z.string().min(1).max(30),
  body: z.string().max(90).optional(),
  visual: z
    .object({
      motif: z.string().max(90),
      emphasis: z
        .enum(["number", "keyword", "calm", "action"])
        .default("keyword"),
    })
    .optional(),
});

export const SlideDetailListSchema = z.object({
  slides: z.array(SlideDetailSchema).min(MIN_SLIDES).max(MAX_SLIDES),
});

export const slidesTool: Tool = {
  name: SLIDES_TOOL_NAME,
  description:
    "확정된 번들 기획을 슬라이드별 상세 카피 + 비주얼 디렉션으로 구체화. slidePlan의 역할/순서를 따르되 각 슬라이드의 실제 문구를 작성.",
  input_schema: {
    type: "object",
    properties: {
      slides: {
        type: "array",
        minItems: MIN_SLIDES,
        maxItems: MAX_SLIDES,
        items: {
          type: "object",
          properties: {
            index: { type: "number", description: "1부터 시작(기획의 index와 일치)" },
            role: { type: "string", enum: ["hook", "point", "cta"] },
            kicker: {
              type: "string",
              description: "상단 작은 라벨(예: '모집 안내'). 선택, 24자 이내",
            },
            headline: {
              type: "string",
              description: "슬라이드 핵심 한 줄(권장 8~16자, 최대 30자)",
            },
            body: {
              type: "string",
              description: "보조 1~2줄(최대 90자). hook/cta는 생략 가능",
            },
            visual: {
              type: "object",
              description: "이 슬라이드의 비주얼 디렉션",
              properties: {
                motif: {
                  type: "string",
                  description: "비주얼 모티프/장면 한 줄(per-slide 배경 생성에 사용)",
                },
                emphasis: {
                  type: "string",
                  enum: ["number", "keyword", "calm", "action"],
                  description: "강조 톤: 숫자/키워드/차분/행동",
                },
              },
              required: ["motif"],
            },
          },
          required: ["index", "role", "headline"],
        },
      },
    },
    required: ["slides"],
  },
};

// ── 시스템/메시지 빌더 ─────────────────────────────────────────
function toneLine(isNotice: boolean): string {
  return isNotice
    ? "톤: 사무적·정확·신뢰. 과장·감탄사·물결표 금지. 원문에 없는 사실 창작 금지."
    : "톤: 명료하고 임팩트 있게. 한국어 SNS 카드뉴스 톤(번역체·AI 티 배제). 사실 기반.";
}

export function buildConceptSystem(
  opts: { isNotice?: boolean; toneOverride?: string | null } = {},
): string {
  const over = opts.toneOverride?.trim()
    ? `\n톤 오버라이드(우선): ${opts.toneOverride.trim()}`
    : "";
  return `당신은 인스타그램 캐러셀(카드뉴스)의 '기획자'입니다. 원문을 한 묶음의 캐러셀로 기획합니다.
이 단계는 개별 슬라이드 카피를 쓰는 단계가 아니라, 캐러셀 '전체'의 방향을 잡는 단계입니다.

## 해야 할 일
- bigIdea: 캐러셀을 관통하는 한 줄 콘셉트.
- coreMessage: 독자가 끝까지 보고 가져갈 단 하나의 메시지.
- target / tone: 누구에게, 어떤 톤으로.
- narrativeArc: 슬라이드를 관통하는 서사 흐름(훅 → 전개 → 행동)을 한 문단으로.
- slideCount: 콘텐츠 양에 맞는 권장 슬라이드 수(${MIN_SLIDES}~${MAX_SLIDES}).
- template: 톤·주제에 맞는 비주얼 템플릿 1개 선택. midnight=신뢰·차분 다크블루(정보/공지/B2B), noir=프리미엄·에디토리얼 블랙&골드(럭셔리/브랜딩), vivid=에너지·모던 비비드(프로모션/MZ).
- slidePlan: 각 슬라이드가 책임질 역할/목적을 '한 줄'씩(상세 카피 금지).

## 원칙
- 슬라이드 1 = hook, 마지막 = cta, 중간 = point.
- 슬라이드 간 흐름이 끊기지 않도록 서사적으로 연결.
- ${toneLine(Boolean(opts.isNotice))}${over}

도구 ${CONCEPT_TOOL_NAME} 로만 기록.`;
}

export function buildConceptMessages(input: {
  rawContent: string;
  noticeMeta?: NoticeMeta | null;
  brandName?: string | null;
}): { role: "user"; content: string }[] {
  const meta = input.noticeMeta
    ? `\n\n# 정보 슬롯(추출됨)\n${formatNoticeMeta(input.noticeMeta)}`
    : "";
  const brand = input.brandName ? `\n\n# 브랜드\n${input.brandName}` : "";
  return [
    {
      role: "user",
      content: `# 원문 (이 사실만 사용)
${input.rawContent.trim()}${meta}${brand}

# TASK
위 원문을 캐러셀 '기획'으로 설계해 ${CONCEPT_TOOL_NAME} 로 기록.`,
    },
  ];
}

export function buildSlideDetailSystem(
  opts: { isNotice?: boolean; toneOverride?: string | null } = {},
): string {
  const over = opts.toneOverride?.trim()
    ? `\n톤 오버라이드(우선): ${opts.toneOverride.trim()}`
    : "";
  return `당신은 확정된 캐러셀 '기획'을 슬라이드별 상세 카피로 구체화하는 카피라이터입니다.

## 원칙
- 주어진 기획(bigIdea/coreMessage/narrativeArc/slidePlan)을 충실히 따른다. 슬라이드 수/역할/순서를 지킨다.
- 각 슬라이드: headline은 짧게(권장 8~16자), body는 1~2줄. 모바일 가독성 우선.
- 슬라이드 간 흐름이 기획의 서사대로 이어지게.
- visual.motif: 그 슬라이드에 어울리는 비주얼 모티프 한 줄.
- ${toneLine(Boolean(opts.isNotice))}${over}

도구 ${SLIDES_TOOL_NAME} 로만 기록.`;
}

export function buildSlideDetailMessages(input: {
  conceptJson: string;
  rawContent: string;
  noticeMeta?: NoticeMeta | null;
  brandName?: string | null;
}): { role: "user"; content: string }[] {
  const meta = input.noticeMeta
    ? `\n\n# 정보 슬롯(추출됨)\n${formatNoticeMeta(input.noticeMeta)}`
    : "";
  const brand = input.brandName ? `\n\n# 브랜드\n${input.brandName}` : "";
  return [
    {
      role: "user",
      content: `# 확정된 기획
${input.conceptJson}

# 원문 (사실 근거)
${input.rawContent.trim()}${meta}${brand}

# TASK
위 기획을 슬라이드별 상세 카피 + 비주얼 디렉션으로 구체화해 ${SLIDES_TOOL_NAME} 로 기록.`,
    },
  ];
}
