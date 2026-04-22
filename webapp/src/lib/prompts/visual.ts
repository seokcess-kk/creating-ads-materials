import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory, BrandKeyVisual } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { StrategyAlternative } from "./strategy";
import type { CopyVariant } from "./copy";
import type { ChannelConfig } from "@/lib/channels";
import { buildVisualPatternDigestEn, type FunnelGoal } from "@/lib/vision/digest";

export const VISUAL_PROMPT_VERSION = "visual@3.1.0";
export const VISUAL_ASSET_PROMPT_VERSION = "visual-asset@1.0.0";
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

function focusInstruction(spec: VisualVariantSpec, strategy: StrategyAlternative): string {
  switch (spec.focus) {
    case "product_focus":
      return `Primary focal: stylized product/UI screenshot or object representing the strategy "${strategy.angleName}".`;
    case "number_focus":
      return `Primary focal: a bold oversized number or percentage pulled from the strategy/offer (e.g. "40%" or "99,000"). Typography-driven design.`;
    case "persona_focus":
      return `Primary focal: lifestyle scene matching the target persona's context. NO individual facial close-ups. Avoid explicit identity/demographic labeling per Meta policy.`;
  }
}

function compositionGuide(channel: ChannelConfig): string {
  switch (channel.aspectRatio) {
    case "1:1":
      return `- Full-bleed 1:1 square, balanced top/center/bottom composition
- Headline zone top-center, CTA near bottom-center
- Leave natural breathing space around corners; do not fill every edge`;
    case "4:5":
      return `- Vertical 4:5, three-band layout (top headline / mid focal / bottom CTA)
- Generous vertical spacing; corners should not be visually busy`;
    case "9:16":
      return `- Full-screen vertical 9:16 (story/reel format)
- Upper 40% = headline + key number; middle 40% = focal subject; lower 20% = CTA with breathing room
- Avoid placing critical elements within the bottom 10% (UI overlap risk)
- Corners should remain visually quiet — no decorative elements near corners`;
    case "16:9":
      return `- Landscape 16:9, focus left-to-right reading
- Headline on left half, focal/CTA on right
- Keep corners visually quiet`;
  }
}

export interface VisualPromptContext {
  memory: BrandMemory;
  strategy: StrategyAlternative;
  selectedCopy: CopyVariant;
  playbook: Playbook;
  channel: ChannelConfig;
  goal: FunnelGoal;
  regenInstruction?: string;
}

export function buildGeminiPrompt(
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
): string {
  const brand = ctx.memory.brand.name;
  const category = ctx.memory.brand.category ?? "business";
  const focus = focusInstruction(spec, ctx.strategy);
  const visualDirection = ctx.strategy.visualDirection;
  const playbookAvoid = ctx.playbook.visualGuide.avoid.join(", ");
  const channelFitKey = ctx.channel.id.split("_")[0];
  const bpPatterns = buildVisualPatternDigestEn(ctx.memory, {
    goal: ctx.goal,
    channel: channelFitKey,
  });
  const composition = compositionGuide(ctx.channel);

  const headline = ctx.selectedCopy.headline;
  const sub = ctx.selectedCopy.subCopy;
  const cta = ctx.selectedCopy.cta;

  return `Design a COMPLETE ${ctx.channel.aspectRatio} (${ctx.channel.width}x${ctx.channel.height}) premium ${ctx.channel.platform} paid ad for a Korean ${category} brand "${brand}". This is the final, ship-ready creative — render everything including typography.

# CRITICAL — NO LOGO / NO BRAND MARK
Absolutely do NOT draw, render, or imply any logo, brand mark, wordmark, icon, watermark, badge, emblem, or any brand-identifying graphic anywhere in the image — not in corners, not anywhere. The brand logo is overlaid later in a separate compose step. If the variant focus involves a product screenshot, the UI inside it is fine but remove any logo on the UI.

# Channel
- Platform: ${ctx.channel.platform} · ${ctx.channel.label}
- Dimensions: ${ctx.channel.width}x${ctx.channel.height} (${ctx.channel.aspectRatio})

# Text to render IN THE IMAGE (Korean, exact spelling, typography rendered as part of the image)
- Headline: "${headline}"
- Sub copy: "${sub}"
- CTA button text: "${cta}"

Render these as real typography (not placeholder boxes). Use premium Korean geometric sans-serif (Pretendard style). Ensure every character is legible, crisp, and properly kerned.

# Strategy angle
- ${ctx.strategy.angleName} (${ctx.strategy.hookType} hook, ${ctx.strategy.frameworkId})
- Intent: ${visualDirection}

# Variant focus
${spec.label} — ${focus}

# Past BP visual patterns (respect where aligned, vary subtly)
${bpPatterns}

# Channel composition rules
${composition}

# Avoid
- Before/after comparison (Meta policy)
- Individual facial close-ups with demographic labeling
- Generic stock photo feel, cluttered layout
- AI-uncanny distortions in Korean characters
- Drawing any logo, brand mark, wordmark, icon, watermark, badge, or emblem — anywhere
- ${playbookAvoid}

# Style
Modern, premium, performance-advertising aesthetic for the Korean market. Crisp typography, strong hierarchy, feed-stopping contrast.${
    ctx.regenInstruction
      ? `

# User re-generation direction
${ctx.regenInstruction}`
      : ""
  }`;
}

// ========== Asset-based (Track B / editImage) ==========
// 실사 Key Visual을 baseImage로 넣고 Gemini editImage를 호출할 때의 프롬프트.
// 원본의 피사체·구도·조명·색조를 보존하고 텍스트·그래픽만 추가한다.

export interface AssetPromptContext extends VisualPromptContext {
  keyVisual: BrandKeyVisual;
}

function emptyAreaHint(kv: BrandKeyVisual): string {
  if (kv.focal_area) {
    const { x, y, w, h } = kv.focal_area;
    return `핵심 피사체는 (x=${(x * 100).toFixed(0)}%, y=${(y * 100).toFixed(0)}%, w=${(w * 100).toFixed(0)}%, h=${(h * 100).toFixed(0)}%) 영역에 있음. 이 영역 밖의 여백에만 텍스트 배치.`;
  }
  return "사진의 자연스러운 여백(주로 하늘·벽·단색 영역)에 텍스트 배치. 피사체 위에 직접 얹지 않음.";
}

function moodLine(kv: BrandKeyVisual): string {
  if (!kv.mood_tags?.length) return "";
  return `Mood: ${kv.mood_tags.join(", ")}. 타이포·그래픽 스타일을 이 무드와 정합시킴.`;
}

export function buildEditImagePrompt(
  ctx: AssetPromptContext,
  spec: VisualVariantSpec,
): string {
  const brand = ctx.memory.brand.name;
  const category = ctx.memory.brand.category ?? "business";
  const kv = ctx.keyVisual;
  const visualDirection = ctx.strategy.visualDirection;
  const playbookAvoid = ctx.playbook.visualGuide.avoid.join(", ");
  const composition = compositionGuide(ctx.channel);

  const headline = ctx.selectedCopy.headline;
  const sub = ctx.selectedCopy.subCopy;
  const cta = ctx.selectedCopy.cta;

  return `You are given a real photograph as the base image. Transform it into a ${ctx.channel.aspectRatio} (${ctx.channel.width}x${ctx.channel.height}) premium ${ctx.channel.platform} paid ad for the Korean ${category} brand "${brand}".

# CRITICAL — PRESERVE THE ORIGINAL PHOTOGRAPH
- Keep the original subject, composition, lighting, and color tone EXACTLY as in the base image
- Do NOT redraw, replace, or stylize any person, product, space, or existing object in the photo
- Do NOT alter faces, bodies, clothing, or poses — identity must be preserved pixel-accurately
- Only ADD: typography (headline / sub / CTA button) and minimal graphic accents (thin lines, subtle gradient overlays for legibility)
- The final image must look like the SAME photograph with added advertising text on top

# Base photo context (for your reference)
- Kind: ${kv.kind}
- Label: ${kv.label}
- Description: ${kv.description ?? "(unavailable)"}
- ${moodLine(kv)}
- ${emptyAreaHint(kv)}

# Channel
- Platform: ${ctx.channel.platform} · ${ctx.channel.label}
- Dimensions: ${ctx.channel.width}x${ctx.channel.height} (${ctx.channel.aspectRatio})

# Text to render ON TOP of the photograph (Korean, exact spelling)
- Headline: "${headline}"
- Sub copy: "${sub}"
- CTA button text: "${cta}"

Render these as real typography (not placeholder boxes). Use premium Korean geometric sans-serif (Pretendard style). Ensure every character is legible, crisp, and properly kerned.

# Strategy angle (to guide text placement/emphasis only — NOT to modify the image)
- ${ctx.strategy.angleName} (${ctx.strategy.hookType} hook, ${ctx.strategy.frameworkId})
- Intent: ${visualDirection}

# Variant focus
${spec.label} — this dictates text hierarchy/emphasis, not photo modification.

# Channel composition rules
${composition}

# Typography placement rules
- Place headline in the upper/lower empty area, avoiding the focal subject
- Use a subtle dark-to-transparent gradient (opacity ≤ 30%) only if needed for legibility over busy areas
- CTA button: solid contrasting color, rounded corners, near bottom with breathing room
- Brand logo is overlaid separately later — DO NOT add any logo/wordmark/watermark

# Avoid
- Any modification to the original photograph's subject, face, pose, clothing, composition
- Drawing any logo, brand mark, wordmark, icon, watermark, badge, emblem anywhere
- Heavy filters, stylization, cartoonification of the photograph
- Before/after comparison layouts (Meta policy)
- ${playbookAvoid}

# Style
Premium, clean, performance-advertising typography laid over a REAL photograph. The photo stays photographic; only the text layer is designed.${
    ctx.regenInstruction
      ? `

# User re-generation direction
${ctx.regenInstruction}`
      : ""
  }`;
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
          "1~5. 헤드라인·CTA가 이미지 안에서 이미 잘 렌더되어 있는가 (loader/타이포 품질)",
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
- textReady(1~5): 이미지 내에 이미 렌더된 한국어 타이포(헤드라인/서브/CTA)의 가독성·정확성
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
  const context = `이 이미지는 브랜드 "${brand}"의 ${ctx.channel.label} BOFU 광고 후보(${spec.label})입니다.
전략: ${ctx.strategy.angleName} (${ctx.strategy.hookType}, ${ctx.strategy.frameworkId})
예상 카피 — 헤드라인: "${ctx.selectedCopy.headline}" / CTA: "${ctx.selectedCopy.cta}"
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

// ========== 배치 Validator (variant N개를 한 번의 Claude 호출로 평가) ==========
// 기존 per-variant 3회 호출을 1회로 합쳐 공통 context 재전송을 제거. 입력 토큰 65%↓.

export const VISUAL_BATCH_VALIDATOR_TOOL = "record_visual_batch_validator";

export const VisualBatchValidatorItemSchema = VisualValidatorSchema.extend({
  variantId: z.string(),
});
export type VisualBatchValidatorItem = z.infer<typeof VisualBatchValidatorItemSchema>;

export const VisualBatchValidatorSchema = z.object({
  variants: z.array(VisualBatchValidatorItemSchema).min(1),
});
export type VisualBatchValidatorResult = z.infer<typeof VisualBatchValidatorSchema>;

export const visualBatchValidatorTool: Tool = {
  name: VISUAL_BATCH_VALIDATOR_TOOL,
  description: "여러 광고 비주얼 후보를 각각 4축으로 한 번에 평가",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        description: "제시된 이미지 각각에 대한 평가 (variantId로 매핑)",
        items: {
          type: "object",
          properties: {
            variantId: {
              type: "string",
              description: "예: vis_1, vis_2, vis_3 — 이미지 앞에 표시된 라벨과 동일",
            },
            hookStrength: { type: "number", description: "1~5. 첫 3초 스크롤 멈춤" },
            textReady: {
              type: "number",
              description: "1~5. 이미지 내 렌더된 한국어 타이포 가독성·정확성",
            },
            brandConsistency: { type: "number", description: "1~5. 브랜드 컬러·톤 일관성" },
            policyClear: {
              type: "number",
              description: "1~5. Meta 정책 준수(before-after, 단정, 부적절 콘텐츠 없음)",
            },
            overall: { type: "number", description: "1~5. 4축 산술 평균" },
            issues: { type: "array", items: { type: "string" } },
            suggestions: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
          required: [
            "variantId",
            "hookStrength",
            "textReady",
            "brandConsistency",
            "policyClear",
            "overall",
          ],
        },
      },
    },
    required: ["variants"],
  },
};

export interface ValidatorBatchItem {
  variantId: string;
  imageUrl: string;
  spec: VisualVariantSpec;
}

export function buildBatchValidatorMessages(
  items: ValidatorBatchItem[],
  ctx: VisualPromptContext,
): MessageParam[] {
  const brand = ctx.memory.brand.name;
  const header = `아래는 브랜드 "${brand}" ${ctx.channel.label} BOFU 광고의 후보 ${items.length}개입니다.
전략: ${ctx.strategy.angleName} (${ctx.strategy.hookType}, ${ctx.strategy.frameworkId})
예상 카피 — 헤드라인: "${ctx.selectedCopy.headline}" / CTA: "${ctx.selectedCopy.cta}"

각 이미지는 바로 앞에 표시된 "### variantId: ..." 라벨로 식별됩니다.
각각에 대해 4축(hookStrength·textReady·brandConsistency·policyClear)을 1~5점으로 매기고,
${VISUAL_BATCH_VALIDATOR_TOOL} 도구로 한 번에 기록하세요.`;

  const content: MessageParam["content"] = [{ type: "text", text: header }];
  for (const it of items) {
    content.push({
      type: "text",
      text: `### variantId: ${it.variantId} (${it.spec.label})`,
    });
    content.push({ type: "image", source: { type: "url", url: it.imageUrl } });
  }

  return [{ role: "user", content }];
}
