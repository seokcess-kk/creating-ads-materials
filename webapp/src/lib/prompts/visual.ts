import { z } from "zod";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { BrandMemory, BrandKeyVisual } from "@/lib/memory/types";
import type { Playbook } from "@/lib/playbook/types";
import type { StrategyAlternative } from "./strategy";
import type { CopyVariant } from "./copy";
import type { ChannelConfig } from "@/lib/channels";
import { buildVisualPatternDigestEn, type FunnelGoal } from "@/lib/vision/digest";

export const VISUAL_PROMPT_VERSION = "visual@3.2.0";
export const VISUAL_ASSET_PROMPT_VERSION = "visual-asset@1.1.0";
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
  // 브랜드 폰트 설정에서 추출한 typography 서술 (prompt-hints.buildTypographyHint 결과).
  // null이면 기본 "Pretendard-style" fallback 사용.
  typographyHint?: string | null;
  regenInstruction?: string;
  // 안내문(notice) 모드: 텍스트를 굽지 않고 깔끔한 "글자 없는 배경"만 생성.
  // 카피는 compose 단계에서 컴포지터 오버레이로 얹는다(이중 텍스트 방지).
  isNotice?: boolean;
  toneOverride?: string | null;
}

// 안내문(notice) 배경 변형 — 3개 spec을 배경 무드 변주로 매핑(텍스트·인물·로고 없음).
function noticeBackgroundVariation(spec: VisualVariantSpec): string {
  switch (spec.focus) {
    case "product_focus":
      return "Clean solid or very subtle two-tone background with a calm flat color field. Minimal, generous empty space.";
    case "number_focus":
      return "Soft minimal geometric background (thin lines / gentle grid / subtle shapes) suggesting structure and order. Very low contrast, plenty of empty space.";
    case "persona_focus":
      return "Gentle smooth gradient background, warm but restrained, conveying trust and calm. No people, no objects, large empty area.";
  }
}

export function buildNoticeBackgroundPrompt(
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
): string {
  const category = ctx.memory.brand.category ?? "business";
  const composition = compositionGuide(ctx.channel);
  const tone = ctx.toneOverride?.trim();
  return `Design a CLEAN, TEXTLESS BACKGROUND for a Korean ${category} informational notice card (${ctx.channel.aspectRatio}, ${ctx.channel.width}x${ctx.channel.height}). All text and the logo are overlaid later in a separate step — your output must contain NO letters, NO numbers, NO logo.

# CRITICAL — ABSOLUTELY NO TEXT, NO LOGO
- Do NOT render any text, letters, numbers, words, captions, labels, or typography anywhere.
- Do NOT draw any logo, wordmark, icon, watermark, badge, or emblem.
- The image is a pure background/canvas onto which Korean text will be composited afterward.

# Background concept
- ${noticeBackgroundVariation(spec)}
- Intent (tone/space only, no text): ${ctx.strategy.visualDirection}
- Thematic mood — evoke the SUBJECT of this notice WITHOUT rendering any text/letters/numbers: "${ctx.selectedCopy.headline}" (${ctx.strategy.keyMessage}). Translate it into color/atmosphere/abstract imagery only.
- Keep a clearly readable, uncluttered central/upper region with high legibility for overlaid text (avoid busy patterns where text will sit).

# Tone
- Sober, clear, trustworthy, administrative. ${tone ? `Tone override: ${tone}.` : "Avoid premium/luxury flashiness, avoid gold-glitter aesthetics, avoid feed-stopping hype."}
- Calm, restrained palette. Soft contrast. This is an informational notice, not a hype ad.

# Channel composition (leave these zones clean for text)
${composition}

# Avoid
- Any text, number, or character of any language
- Any logo, brand mark, watermark, emblem
- People, faces, product close-ups
- Busy, cluttered, high-contrast hype visuals
- Before/after layouts${
    ctx.regenInstruction
      ? `

# User re-generation direction
${ctx.regenInstruction}`
      : ""
  }`;
}

export function buildGeminiPrompt(
  ctx: VisualPromptContext,
  spec: VisualVariantSpec,
): string {
  if (ctx.isNotice) return buildNoticeBackgroundPrompt(ctx, spec);
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

Render these as real typography (not placeholder boxes). Ensure every character is legible, crisp, and properly kerned.

# Typography (brand font style guide — follow closely)
${ctx.typographyHint ?? "Use premium Korean geometric sans-serif (Pretendard-style), consistent stroke widths."}

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

Render these as real typography (not placeholder boxes). Ensure every character is legible, crisp, and properly kerned.

# Typography (brand font style guide — follow closely)
${ctx.typographyHint ?? "Use premium Korean geometric sans-serif (Pretendard-style), consistent stroke widths."}

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

export function buildValidatorSystem(isNotice = false): string {
  if (isNotice) {
    return `당신은 안내문 소재용 "글자 없는 배경"을 4축으로 평가하는 크리에이티브 디렉터입니다. 텍스트·로고는 이후 합성 단계에서 얹히므로 이 이미지에는 텍스트·로고가 없어야 정상입니다.

평가 기준 (안내문 배경 기준으로 재해석):
- hookStrength(1~5): 정보 카드로서의 정돈감·차분함·시선 안정. 과한 hype가 아닐수록 높음
- textReady(1~5): 오버레이될 한국어 텍스트를 위한 깨끗하고 가독성 높은 빈 영역 확보도 (글자가 없고 텍스트 자리가 깔끔할수록 높음)
- brandConsistency(1~5): 브랜드 컬러·톤과 일치하되 프리미엄 과시 없이 중립적
- policyClear(1~5): 정책 준수 + 텍스트·로고 미포함
- overall: 4축 산술 평균

도구 ${VISUAL_VALIDATOR_TOOL}로 기록.`;
  }
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
  const context = ctx.isNotice
    ? `이 이미지는 브랜드 "${brand}"의 ${ctx.channel.label} 안내문 소재용 "글자 없는 배경" 후보(${spec.label})입니다.
텍스트·로고는 이후 합성에서 얹히므로 이 이미지엔 글자가 없어야 정상입니다.
오버레이될 카피(참고) — 헤드라인: "${ctx.selectedCopy.headline}" / CTA: "${ctx.selectedCopy.cta}"
배경 기준 4축으로 평가해주세요.`
    : `이 이미지는 브랜드 "${brand}"의 ${ctx.channel.label} BOFU 광고 후보(${spec.label})입니다.
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

// Validator 호출자가 넘기는 기본 항목.
export interface ValidatorBatchItem {
  variantId: string;
  imageUrl: string;
  spec: VisualVariantSpec;
}

// 빌더에 넘기는 해상도 축소된 항목 (validator 함수 내부에서 변환).
export interface ResolvedValidatorItem {
  variantId: string;
  spec: VisualVariantSpec;
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export function buildBatchValidatorMessages(
  items: ResolvedValidatorItem[],
  ctx: VisualPromptContext,
): MessageParam[] {
  const brand = ctx.memory.brand.name;
  const header = ctx.isNotice
    ? `아래는 브랜드 "${brand}" ${ctx.channel.label} 안내문 소재용 "글자 없는 배경" 후보 ${items.length}개입니다.
텍스트·로고는 이후 합성에서 얹히므로 각 이미지엔 글자가 없어야 정상입니다.
오버레이될 카피(참고) — 헤드라인: "${ctx.selectedCopy.headline}" / CTA: "${ctx.selectedCopy.cta}"

각 이미지는 바로 앞에 표시된 "### variantId: ..." 라벨로 식별됩니다.
각각에 대해 배경 기준 4축(hookStrength·textReady·brandConsistency·policyClear)을 1~5점으로 매기고,
${VISUAL_BATCH_VALIDATOR_TOOL} 도구로 한 번에 기록하세요.`
    : `아래는 브랜드 "${brand}" ${ctx.channel.label} BOFU 광고의 후보 ${items.length}개입니다.
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
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: it.mediaType,
        data: it.imageBase64,
      },
    });
  }

  return [{ role: "user", content }];
}
