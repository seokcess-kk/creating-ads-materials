import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { NoticeMeta } from "@/lib/campaigns/types";
import { formatNoticeMeta } from "@/lib/notice/extract";

export const CARDNEWS_PROMPT_VERSION = "cardnews@0.1.0";
export const CARDNEWS_TOOL_NAME = "record_cardnews_outline";

export type SlideRole = "hook" | "point" | "cta";

export const SlideSchema = z.object({
  index: z.number().int().min(1),
  role: z.enum(["hook", "point", "cta"]),
  /** 상단 작은 라벨(슬라이드 번호/카테고리 등). 선택. */
  kicker: z.string().max(24).optional(),
  /** 슬라이드 핵심 한 줄. */
  headline: z.string().min(1).max(28),
  /** 보조 1~2줄. hook/cta는 생략 가능. */
  body: z.string().max(80).optional(),
});
export type Slide = z.infer<typeof SlideSchema>;

export const CardNewsOutlineSchema = z.object({
  /** 캐러셀 전체 주제(내부용). */
  title: z.string().min(1).max(40),
  slides: z.array(SlideSchema).min(4).max(6),
});
export type CardNewsOutline = z.infer<typeof CardNewsOutlineSchema>;

export const cardNewsTool: Tool = {
  name: CARDNEWS_TOOL_NAME,
  description:
    "원문을 4~6장짜리 카드뉴스(캐러셀) 아웃라인으로 구조화. 슬라이드1=훅, 중간=핵심 포인트 1개씩, 마지막=CTA.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "캐러셀 전체 주제(내부 식별용)" },
      slides: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        description:
          "순서대로 정렬된 슬라이드. 1번=스크롤 멈추는 훅, 중간=정보 위계대로 핵심 1개씩, 마지막=행동 유도(CTA).",
        items: {
          type: "object",
          properties: {
            index: { type: "number", description: "1부터 시작하는 슬라이드 순서" },
            role: {
              type: "string",
              enum: ["hook", "point", "cta"],
              description: "hook=1번 훅 / point=핵심 포인트 / cta=마지막 행동 유도",
            },
            kicker: {
              type: "string",
              description: "상단 작은 라벨(예: '모집 안내', '01/05'). 선택, 24자 이내",
            },
            headline: {
              type: "string",
              description: "슬라이드 핵심 한 줄(한국어, 공백 제외 8~16자 권장, 최대 28자)",
            },
            body: {
              type: "string",
              description: "보조 설명 1~2줄(최대 80자). hook/cta는 생략 가능",
            },
          },
          required: ["index", "role", "headline"],
        },
      },
    },
    required: ["title", "slides"],
  },
};

export function buildCardNewsSystem(opts: { isNotice?: boolean; toneOverride?: string | null } = {}): string {
  const toneLine = opts.isNotice
    ? "톤: 사무적·정확·신뢰. 과장·감탄사·물결표 금지. 원문에 없는 사실 창작 금지."
    : "톤: 명료하고 임팩트 있게. 한국어 SNS 카드뉴스 톤(번역체·AI 티 배제). 사실 기반.";
  const over = opts.toneOverride?.trim() ? `\n톤 오버라이드(우선): ${opts.toneOverride.trim()}` : "";
  return `당신은 원문을 인스타그램 카드뉴스(캐러셀)로 옮기는 콘텐츠 디자이너입니다. 4~6장 아웃라인을 설계합니다.

## 구성 원칙
- 슬라이드 1 (hook): 스크롤을 멈추게 하는 한 줄. 가장 중요한 사실/숫자/궁금증.
- 중간 (point): 정보 위계대로 핵심을 한 슬라이드에 하나씩. 한 슬라이드 = 한 메시지.
- 마지막 (cta): 다음 행동을 명확히(신청/확인/방문 등). 링크 자체는 캡션에서 처리하므로 행동 문구만.
- 슬라이드당 글자 최소화 — headline은 짧게(권장 8~16자), body는 1~2줄. 모바일 가독성 우선.
- 슬라이드 간 흐름이 자연스럽게 이어지도록(훅 → 근거/조건 → 행동).
- ${toneLine}${over}

도구 ${CARDNEWS_TOOL_NAME}로만 기록.`;
}

export function buildCardNewsMessages(input: {
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
위 원문을 4~6장 카드뉴스 아웃라인으로 구조화. ${CARDNEWS_TOOL_NAME}로 기록.`,
    },
  ];
}
