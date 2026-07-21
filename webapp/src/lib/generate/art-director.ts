import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import type { AspectRatio } from "@/lib/engines";
import type {
  CopyPosition,
  DesignReference,
  ReferenceStrength,
  SingleRenderMode,
} from "./types";
import { formatDesignReference } from "./analyze-reference";

const TOOL = "record_image_prompts";

/** 사용자의 의도·맥락을 구조화한 크리에이티브 브리프. 아트디렉터가 이미지 프롬프트로 확장. */
export interface CreativeBrief {
  /** 알리려는 핵심 메시지/혜택 — 필수(아트디렉터가 리드) */
  keyMessage: string;
  /** 비주얼·장면(선택) — 레퍼런스 첨부 시 자동, 없으면 메시지로 구성 */
  concept?: string | null;
  /** 소재에 얹힐 카피(구도가 텍스트를 위한 여백을 확보하도록 전달) */
  copy?: { headline?: string | null; sub?: string | null; cta?: string | null };
  tone?: string | null;
  /** 구조화 스타일 노브(선택, 영어 구문) — 8슬롯의 팔레트·조명·무드를 직접 지정. */
  lighting?: string | null;
  palette?: string | null;
  mood?: string | null;
  /** 카피 여백 위치(선택) — overlay에서 어느 쪽을 비울지 모델에 전달. */
  copyPosition?: CopyPosition | null;
  brandHint?: string | null;
  designRef?: DesignReference | null;
  aspectRatio: AspectRatio;
  /** overlay = 텍스트 없는 배경(컴포지터가 한글 오버레이) / full = 이미지에 텍스트 베이킹 */
  mode: SingleRenderMode;
  /** 레퍼런스 반영 강도 — style/layout이면 레퍼런스 픽셀이 이미지 모델에 직접 첨부된다. */
  refStrength?: ReferenceStrength | null;
}

// 상한은 캐러셀 아트디렉터와 동일(2000) — 레퍼런스 지시가 붙으면 길어져 1200은 실사용에서 초과됐다.
const ImagePromptSchema = z.object({
  label: z.string().max(40),
  prompt: z.string().min(20).max(2000),
});
const PromptListSchema = z.object({
  variants: z.array(ImagePromptSchema).min(1).max(4),
});
export type ImagePrompt = z.infer<typeof ImagePromptSchema>;

const tool: Tool = {
  name: TOOL,
  description:
    "크리에이티브 브리프를 gpt-image 이미지 모델용 영어 프롬프트 N개로 확장. 각 variant는 서로 다른 구도/앵글.",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "이 시안의 짧은 한국어 라벨(예: '미니멀 클로즈업')" },
            prompt: {
              type: "string",
              description: "gpt-image에 보낼 영어 이미지 프롬프트(상세·구체적, 250단어 이내).",
            },
          },
          required: ["label", "prompt"],
        },
      },
    },
    required: ["variants"],
  },
};

function buildSystem(): string {
  return `You are an expert advertising ART DIRECTOR and prompt engineer for the "gpt-image" text-to-image model.
You receive a creative brief (the user's intent + context) and produce DISTINCT, production-grade English image prompts — one per requested variant. Each variant must be a genuinely different creative direction (composition, angle, framing, focal idea), not a reworded duplicate.

STRUCTURE EVERY PROMPT IN THIS SLOT ORDER (a proven recipe):
1) MEDIUM/STYLE FIRST — pin the medium up front so the look is stable (e.g., "High-end studio product photography", "Flat vector illustration", "Editorial 3D render", "Cinematic lifestyle photo"). Never open with the bare subject.
2) HERO SUBJECT + the single idea the ad must communicate, immediately after the medium.
3) COMPOSITION & BACKGROUND — placement + a controlled background (e.g., "centered on a plain seamless studio background with a soft shadow", "subject on the right third").
4) LIMITED COLOR PALETTE — name 2-3 specific colors and add "only" (e.g., "limited palette of warm sand, olive green and cream only, muted"). Never "nice colors". If a design reference carries hex codes, use those hex values verbatim as the palette (e.g., "limited palette of #0F2044, #FFC838 and #FF6B5E only") — never rename, approximate, or substitute them.
5) LIGHTING — always state it (e.g., "soft golden hour light, gentle rim light", "dramatic studio rim lighting"); unlit scenes look flat and cheap.
6) MOOD — one or two atmosphere words (e.g., "premium, refined, minimal").
7) RESERVED TEXT SPACE — per TEXT HANDLING below.
8) EXCLUSIONS — end with what to avoid (e.g., "no extra text, no logos, no clutter, no extra props").

PHOTOGRAPHIC creatives (product, food, person, lifestyle): add camera vocabulary — lens & aperture + shallow depth of field (50mm f/1.8 for products, 85mm f/1.8 for a person), "photorealistic, high detail". For a physical product, pin its exact form, material and finish (e.g., "sleek matte black case", "frosted glass bottle with a gold cap") so the model never invents a generic or trademark-like product; keep any on-product label area blank.

KEEP IT FOCUSED — one clear focal subject, a few elements, generous empty space; simpler reads stronger. Each variant is a genuinely different direction (composition, angle, framing), not a reworded duplicate. Advertising-grade: intentional focal point, clear hierarchy, clean finish. Respect brand cues and the design reference (palette/mood/composition/layout) when provided. Match the tone, and match the aspect ratio with composition vocabulary (1:1 balanced square; 4:5 / 9:16 vertical, tall composition with the hero up top and copy space below; 16:9 wide widescreen). If a chart, graph, infographic or data visualization appears, render it as DECORATIVE only — its numbers, axes and proportions are NOT real data; for accurate figures leave a clean area (real numbers are composited precisely later).

TEXT HANDLING (critical):
- If mode = "overlay": the image MUST be a CLEAN, TEXTLESS background — NO letters, numbers, words, or logos. Keep the hero subject and all busy detail in the UPPER portion, and reserve a clean, low-detail band across the CENTER and LOWER THIRD (free of faces or focal objects) with strong, even contrast for the Korean copy overlaid later. For tall 9:16 / 4:5, reserve the lower half; for 1:1, the center-to-lower band.
- If mode = "full": render the given Korean text with PERFECT, correct modern Hangul — use ONLY the exact strings provided; never distort, invent, translate, or add characters/captions. Make the headline DOMINANT and large and any sub a clearly smaller subtitle (never a paragraph wall); if text risks garbling, use fewer, larger words. Leave generous whitespace so the type breathes.

REFERENCE IMAGE (when the brief notes one is attached):
- The image model will SEE the reference image directly — it supplies palette, lighting, mood and composition from pixels. Your prompt should focus on describing the NEW scene/subject and copy space, not on re-describing the reference.
- If the design reference in the brief carries hex color values, use them verbatim (never rename, approximate, or substitute them).
- If the brief says the reference is a design TEMPLATE (layout strength), every variant must keep the SAME layout/composition as the reference — differentiate variants by subject, scene detail and styling, NOT by composition.
- Do NOT draw, invent, or place any brand logo — the brand logo is composited separately after generation. Keep the image free of logos/wordmarks.

Output ONLY via the ${TOOL} tool. Prompts must be in English (Korean text-to-render stays in Korean inside the prompt).`;
}

function buildBriefText(brief: CreativeBrief, count: number): string {
  const lines: string[] = [];
  lines.push(`variants requested: ${count}`);
  lines.push(`mode: ${brief.mode}`);
  if (brief.refStrength === "style")
    lines.push(
      "reference: a STYLE reference image is ATTACHED to the image model (its palette/lighting/mood/composition are followed from pixels). Describe the NEW scene/subject.",
    );
  else if (brief.refStrength === "layout")
    lines.push(
      "reference: a design TEMPLATE image is ATTACHED to the image model. Keep the SAME layout/composition in EVERY variant; vary only subject, scene detail and styling.",
    );
  lines.push("do NOT render any brand logo or wordmark (logo is composited separately afterwards).");
  lines.push(`aspect ratio: ${brief.aspectRatio}`);
  lines.push(`key message to communicate (lead with this): ${brief.keyMessage.trim()}`);
  if (brief.concept?.trim()) lines.push(`visual direction / scene (optional): ${brief.concept.trim()}`);
  if (brief.tone?.trim()) lines.push(`tone: ${brief.tone.trim()}`);
  if (brief.palette?.trim())
    lines.push(`color palette (use ONLY these named colors): ${brief.palette.trim()}`);
  if (brief.lighting?.trim()) lines.push(`lighting: ${brief.lighting.trim()}`);
  if (brief.mood?.trim()) lines.push(`mood: ${brief.mood.trim()}`);
  if (brief.brandHint?.trim()) lines.push(`brand cues: ${brief.brandHint.trim()}`);
  if (brief.designRef) lines.push(`design reference (mimic this style): ${formatDesignReference(brief.designRef)}`);

  const c = brief.copy;
  // full 모드인데 카피가 전무하면 순수 비주얼 — 모델이 keyMessage를 멋대로 굽지 않도록 명시 차단.
  if (brief.mode === "full" && !c?.headline && !c?.sub && !c?.cta) {
    lines.push(
      "no copy text provided — the image must be completely TEXTLESS: no letters, words, numbers, or typography of any kind.",
    );
  }
  if (c && (c.headline || c.sub || c.cta)) {
    const copyParts = [
      c.headline ? `headline "${c.headline}"` : null,
      c.sub ? `sub "${c.sub}"` : null,
      c.cta ? `cta "${c.cta}"` : null,
    ].filter(Boolean);
    if (brief.mode === "overlay") {
      const zone =
        brief.copyPosition === "top"
          ? "the upper area"
          : brief.copyPosition === "bottom"
            ? "the lower third"
            : "the center-to-lower area";
      lines.push(
        `copy that will be overlaid LATER (do NOT draw it; reserve a clean, low-detail band at ${zone} with strong even contrast for it): ${copyParts.join(", ")}`,
      );
    } else {
      // full: 헤드라인/서브만 굽고, CTA는 굽지 않고 후합성(또렷한 브랜드 버튼).
      const renderParts = [
        c.headline ? `headline "${c.headline}"` : null,
        c.sub ? `sub "${c.sub}"` : null,
      ].filter(Boolean);
      if (renderParts.length)
        lines.push(
          `Korean text to render in the image (headline dominant and large, sub a smaller subtitle): ${renderParts.join(", ")}`,
        );
      if (c.cta)
        lines.push(
          `reserve a clean, calm band near the bottom for a call-to-action button added separately — do NOT draw the button or its text "${c.cta}"`,
        );
    }
  }
  return lines.join("\n");
}

/**
 * 크리에이티브 브리프 → gpt-image 최적화 프롬프트 N개.
 * 실패 시 null(호출자가 템플릿 프롬프트로 폴백).
 */
export async function buildImagePrompts(
  brief: CreativeBrief,
  count: number,
  usageContext?: UsageContext,
): Promise<ImagePrompt[] | null> {
  try {
    const resp = await callClaude({
      model: "sonnet",
      maxTokens: 1800,
      system: buildSystem(),
      usageContext,
      messages: [
        {
          role: "user",
          content: `# CREATIVE BRIEF\n${buildBriefText(brief, count)}\n\nProduce ${count} distinct prompt(s) via ${TOOL}.`,
        },
      ],
      tools: [tool],
      toolChoice: { type: "tool", name: TOOL },
    });
    const raw = extractToolUse(resp, TOOL);
    if (!raw) return null;
    return PromptListSchema.parse(raw).variants;
  } catch (e) {
    console.warn("아트디렉터 프롬프트 생성 실패(템플릿 폴백):", (e as Error).message);
    return null;
  }
}
