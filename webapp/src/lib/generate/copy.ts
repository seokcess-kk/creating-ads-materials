import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import type { LayerCopySpec } from "./copy-limits";
import type { CopyOption } from "./types";

const TOOL = "record_ad_copy";

const LAYER_ROLES = ["eyebrow", "headline", "price", "sub", "badge", "legal", "footer"] as const;

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
  // 디자인 인지 모드(layerSpec 제공 시): 레퍼런스 실측 레이어 역할 전체를 채우는 확장 카피.
  layers: z
    .record(z.enum(LAYER_ROLES), z.string().max(80))
    .optional(),
});

export const CopyListSchema = z.object({
  options: z.array(CopyOptionSchema).min(3).max(6),
});

const tool: Tool = {
  name: TOOL,
  description:
    "광고 소재용 한국어 카피를 서로 다른 앵글로 여러 벌 작성. 각 벌은 headline(짧게)·sub(선택)·cta(선택)·angle. 레이어 스펙이 주어지면 layers로 역할 전체를 채운다.",
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
            layers: {
              type: "object",
              description:
                "레이어 스펙이 주어진 경우 필수 — 스펙의 모든 역할을 자수 한도 내로 채운 역할별 카피. headline/sub는 위 필드와 동일 값.",
              properties: Object.fromEntries(
                LAYER_ROLES.map((role) => [role, { type: "string" }]),
              ),
            },
          },
          required: ["headline", "angle"],
        },
      },
    },
    required: ["options"],
  },
};

const ROLE_GUIDE: Record<(typeof LAYER_ROLES)[number], string> = {
  eyebrow: "헤드라인 위 짧은 예고(예: 겨울 한정, NEW)",
  headline: "핵심 한 줄",
  price: "가격·수치 강조(예: 35만원, 최대 50%)",
  sub: "보조 설명 한 줄",
  badge: "짧은 뱃지 문구(예: 당일예약, 무료상담)",
  legal: "고지·조건 문구(과장 없이 사실만)",
  footer: "하단 안내(예: 상담 문의·지점명)",
};

function buildSystem(
  tone?: string | null,
  includeCta?: boolean,
  layerSpec?: LayerCopySpec[] | null,
): string {
  const toneLine = tone?.trim() ? `\n톤 오버라이드(우선): ${tone.trim()}` : "";
  const ctaLine =
    includeCta === false
      ? "- cta는 작성하지 않는다(광고 지면 — 매체가 CTA 버튼을 제공)."
      : "- cta는 행동 동사 위주(예: 지금 신청, 자세히 보기).";
  // 디자인 인지 모드 — 레퍼런스 실측 레이어의 역할·자수 한도에 맞춰 처음부터 박스에 맞는 카피를 쓴다.
  const hasPriceLayer = layerSpec?.some((s) => s.role === "price");
  const layerLines = layerSpec?.length
    ? `\n\n## 레이아웃 레이어(필수 — 각 옵션의 layers에 아래 역할 전부를 채울 것)\n${layerSpec
        .map(
          (s) =>
            `- ${s.role}: ${ROLE_GUIDE[s.role]} — 약 ${s.maxChars}자 이내(공백도 폭 절반을 차지), 최대 ${s.maxLines}줄`,
        )
        .join("\n")}\n- layers.headline은 headline과, layers.sub는 sub와 동일한 값으로.\n- 자수 한도는 디자인 박스 크기에서 계산된 값 — 넘기면 글자가 줄어들어 디자인이 깨진다.${
        hasPriceLayer
          ? "\n- 가격·수치는 price 레이어 전용 — headline/sub에는 가격·숫자를 넣지 않는다(중복 노출 방지)."
          : ""
      }`
    : "";
  return `당신은 한국어 디지털 광고 카피라이터입니다. 한 컨셉에 대해 서로 다른 앵글의 카피를 여러 벌 작성합니다.

## 원칙
- 번역체·AI 티 배제. 자연스러운 한국어 SNS 광고 톤.
- headline은 짧고 강하게(권장 8~16자). 모바일 가독성 우선.
- 앵글을 다양하게: 혜택(benefit)·호기심(curiosity)·긴급성(urgency)·사회적증거(social_proof)·감성(emotional).
- 과장/허위 금지. 입력 사실 범위 안에서.
${ctaLine}${toneLine}${layerLines}

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
    /** false면 cta 미생성(광고 지면 — 매체가 네이티브 CTA 버튼 제공). 기본 true. */
    includeCta?: boolean;
    /** 레퍼런스 실측 레이어 스펙 — 있으면 역할 전체를 자수 한도 내로 채운 layers를 함께 생성. */
    layerSpec?: LayerCopySpec[] | null;
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
    maxTokens: input.layerSpec?.length ? 2500 : 1500,
    system: buildSystem(input.tone, input.includeCta, input.layerSpec),
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
  let options = CopyListSchema.parse(raw).options;
  // 지시와 무관하게 모델이 cta를 넣었을 수 있으므로 결정적으로 제거.
  if (input.includeCta === false) {
    options = options.map((o) => ({ ...o, cta: undefined }));
  }
  // 디자인 인지 모드 정합: headline/sub는 layers와 항상 일치시키고, 스펙에 없는 역할은 버린다.
  if (input.layerSpec?.length) {
    const allowed = new Set(input.layerSpec.map((s) => s.role));
    options = options.map((o) => {
      const layers = Object.fromEntries(
        Object.entries(o.layers ?? {}).filter(([role, text]) => allowed.has(role as never) && text?.trim()),
      ) as NonNullable<CopyOption["layers"]>;
      // 가격 배타: price 레이어가 있으면 headline에서 동일 가격 문자열을 결정적으로 제거(중복 노출 방지).
      let headline = o.headline;
      const price = layers.price?.trim();
      if (price && headline.includes(price)) {
        headline = headline.replace(price, "").replace(/[·|,/+\-]+\s*$/, "").replace(/\s{2,}/g, " ").trim() || o.headline;
      }
      return {
        ...o,
        headline,
        layers: { ...layers, headline, ...(o.sub ? { sub: o.sub } : {}) },
      };
    });
  }
  return options;
}
