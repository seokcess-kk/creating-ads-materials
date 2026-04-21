import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { StrategyAlternative } from "./strategy";
import type { CopyVariant } from "./copy";
import { buildVisualPatternDigestEn } from "@/lib/vision/digest";

export const VISUAL_PROMPT_VERSION = "visual@2.0.0";
export const VISUAL_VALIDATOR_TOOL = "record_visual_validator";

export type VisualFocus = "product_focus" | "number_focus" | "persona_focus";

export interface VisualVariantSpec {
  id: string;
  focus: VisualFocus;
  label: string;
  description: string;
}

export const VISUAL_VARIANT_SPECS: VisualVariantSpec[] = [
  {
    id: "vis_1",
    focus: "product_focus",
    label: "제품·UI 중심",
    description: "제품 화면·UI·인터페이스를 주요 시각 요소로",
  },
  {
    id: "vis_2",
    focus: "number_focus",
    label: "숫자·통계 중심",
    description: "대형 숫자·통계·증거 시각화 중심",
  },
  {
    id: "vis_3",
    focus: "persona_focus",
    label: "인물·상황 중심",
    description: "페르소나와 유사한 인물·상황 연출 (구체 외모 단정 금지)",
  },
];

function colorHint(memory: BrandMemory): string {
  const colors = memory.identity?.colors_json ?? [];
  if (colors.length === 0) return "balanced modern palette";
  return colors.map((c) => `${c.role} ${c.hex}`).join(", ");
}

function focusInstruction(spec: VisualVariantSpec, strategy: StrategyAlternative): string {
  switch (spec.focus) {
    case "product_focus":
      return `Primary focal: stylized product/UI screenshot or object representing the strategy "${strategy.angleName}". Large centered composition with negative space below for CTA overlay.`;
    case "number_focus":
      return `Primary focal: a bold oversized number or percentage pulled from the strategy/offer (e.g. "40%" or "99,000"). Typography-driven design. Supportive icon optional.`;
    case "persona_focus":
      return `Primary focal: lifestyle scene matching the target persona's context. NO individual facial close-ups. Avoid explicit identity/demographic labeling per Meta policy. Soft story composition.`;
  }
}

export interface VisualPromptContext {
  memory: BrandMemory;
  strategy: StrategyAlternative;
  selectedCopy: CopyVariant;
  playbook: Playbook;
}

export function buildGeminiPrompt(
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
): string {
  const brand = ctx.memory.brand.name;
  const category = ctx.memory.brand.category ?? "business";
  const colors = colorHint(ctx.memory);
  const focus = focusInstruction(spec, ctx.strategy);
  const visualDirection = ctx.strategy.visualDirection;
  const playbookFocus = ctx.playbook.visualGuide.focus.join(", ");
  const playbookAvoid = ctx.playbook.visualGuide.avoid.join(", ");

  const bpPatterns = buildVisualPatternDigestEn(ctx.memory);

  return `Design a 1:1 (1080x1080) premium Instagram Feed paid ad background for a Korean ${category} brand "${brand}".

# Strategy angle
- ${ctx.strategy.angleName} (${ctx.strategy.hookType} hook, ${ctx.strategy.frameworkId})
- Intent: ${visualDirection}

# Variant focus
${spec.label} — ${focus}

# Brand palette
${colors}

# Past BP visual patterns (respect where aligned, vary subtly to avoid copy)
${bpPatterns}

# Composition rules
- Full-bleed 1:1, high contrast, feed-stopping composition
- Reserve top-center (~40% height) for headline text overlay
- Reserve bottom-right (~15% area) for CTA button
- Keep center zone clear of fine detail
- Playbook focus: ${playbookFocus}

# Avoid
- Heavy pre-rendered text (headline/CTA will be overlaid separately)
- Before/after comparison (Meta policy)
- Individual facial close-ups with demographic labeling
- Generic stock photo feel, cluttered layout
- ${playbookAvoid}

# Style
Modern, premium, performance-advertising aesthetic, Korean market, 3-color palette, crisp edges, photographic or clean illustrative, NOT AI-uncanny.`;
}

export const VisualValidatorSchema = z.object({
  hookStrength: z.number().min(1).max(5),
  textReady: z.number().min(1).max(5),
  brandConsistency: z.number().min(1).max(5),
  policyClear: z.number().min(1).max(5),
  overall: z.number().min(1).max(5),
  issues: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type VisualValidatorResult = z.infer<typeof VisualValidatorSchema>;

export const visualValidatorTool: Tool = {
  name: VISUAL_VALIDATOR_TOOL,
  description: "광고 비주얼 후보를 4축으로 평가",
  input_schema: {
    type: "object",
    properties: {
      hookStrength: {
        type: "number",
        description: "1~5. 첫 3초 스크롤 멈춤. 수치·대비·대상 명확도",
      },
      textReady: {
        type: "number",
        description:
          "1~5. Canvas에서 헤드라인/서브/CTA 오버레이할 공간(상단·하단)이 충분한가",
      },
      brandConsistency: {
        type: "number",
        description: "1~5. 브랜드 컬러·톤 일관성",
      },
      policyClear: {
        type: "number",
        description:
          "1~5. Meta 정책 위반 요소 없음(before-after, 개인 속성 단정, 부적절 콘텐츠)",
      },
      overall: { type: "number", description: "1~5. 4축 산술 평균" },
      issues: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
    required: [
      "hookStrength",
      "textReady",
      "brandConsistency",
      "policyClear",
      "overall",
    ],
  },
};

export function buildValidatorSystem(): string {
  return `당신은 퍼포먼스 광고 비주얼을 4축으로 평가하는 크리에이티브 디렉터입니다.

평가 기준:
- hookStrength(1~5): 첫 3초 스크롤 멈춤. 수치·인물·제품 시선 유도·색 대비가 강할수록 높음
- textReady(1~5): Canvas 오버레이할 공간이 상단(헤드라인)·하단(CTA)에 충분한가. 중앙이 복잡하면 낮음
- brandConsistency(1~5): 주어진 브랜드 컬러·톤과 일치 정도
- policyClear(1~5): Meta/Google 광고 정책 준수 (before-after, 개인 속성 단정, 부적절 콘텐츠 없음)
- overall: 4축 산술 평균

도구 ${VISUAL_VALIDATOR_TOOL}로 기록.`;
}

export function buildValidatorMessages(
  imageUrl: string,
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
): MessageParam[] {
  const brand = ctx.memory.brand.name;
  const palette = colorHint(ctx.memory);
  const context = `이 이미지는 브랜드 "${brand}"의 IG Feed 1:1 BOFU 광고 후보(${spec.label})입니다.
전략: ${ctx.strategy.angleName} (${ctx.strategy.hookType}, ${ctx.strategy.frameworkId})
예상 카피 — 헤드라인: "${ctx.selectedCopy.headline}" / CTA: "${ctx.selectedCopy.cta}"
브랜드 컬러: ${palette}
이 맥락에서 4축으로 평가해주세요.`;

  return [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "url", url: imageUrl },
        },
        { type: "text", text: context },
      ],
    },
  ];
}
