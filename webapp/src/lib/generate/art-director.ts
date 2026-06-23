import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import type { AspectRatio } from "@/lib/engines";
import type { DesignReference, SingleRenderMode } from "./types";
import { formatDesignReference } from "./analyze-reference";

const TOOL = "record_image_prompts";

/** 사용자의 의도·맥락을 구조화한 크리에이티브 브리프. 아트디렉터가 이미지 프롬프트로 확장. */
export interface CreativeBrief {
  /** 사용자가 입력한 장면/아이디어 */
  concept: string;
  /** 알리려는 핵심 메시지/혜택 */
  keyMessage?: string | null;
  /** 소재에 얹힐 카피(구도가 텍스트를 위한 여백을 확보하도록 전달) */
  copy?: { headline?: string | null; sub?: string | null; cta?: string | null };
  tone?: string | null;
  brandHint?: string | null;
  designRef?: DesignReference | null;
  aspectRatio: AspectRatio;
  /** overlay = 텍스트 없는 배경(컴포지터가 한글 오버레이) / full = 이미지에 텍스트 베이킹 */
  mode: SingleRenderMode;
  /** 레퍼런스 사진 자체를 변형(editImage)하는 경우 true */
  isEdit?: boolean;
  /** 브랜드 로고를 입력 이미지로 함께 전달해 통합하는 경우 true */
  hasLogo?: boolean;
}

const ImagePromptSchema = z.object({
  label: z.string().max(40),
  prompt: z.string().min(20).max(1200),
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
              description: "gpt-image에 보낼 영어 이미지 프롬프트(상세·구체적).",
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

WRITE PROMPTS THAT MAKE EFFECTIVE ADS:
- Lead with the subject and the single idea the ad must communicate, then describe setting, lighting, mood, color, composition, and camera/lens feel concretely.
- Advertising-grade quality: intentional focal point, clear visual hierarchy, clean professional finish.
- Respect the brand cues and the design reference (palette/mood/composition/layout) when provided.
- Match the tone. Match the aspect ratio's framing.

TEXT HANDLING (critical):
- If mode = "overlay": the image MUST be a CLEAN, TEXTLESS background — NO letters, numbers, words, or logos. Deliberately leave calm, uncluttered NEGATIVE SPACE with good contrast where the Korean copy will be overlaid later (size the empty area to fit the given copy length and placement).
- If mode = "full": render the given Korean text in the image clearly with PERFECT, correct Hangul; do not distort or invent characters. Strong typographic hierarchy.

INPUT IMAGES (when provided):
- If a base reference photo is provided (isEdit), write a TRANSFORMATION instruction: preserve its core subject, restyle it into the ad direction.
- If a brand logo is provided (hasLogo), instruct to INTEGRATE the brand logo into the scene naturally and KEEP IT UNDISTORTED and legible — place it small (a corner, or subtly on the product/packaging). Never alter the logo's letters, colors, or shape, and do NOT invent a different logo.

Output ONLY via the ${TOOL} tool. Prompts must be in English (Korean text-to-render stays in Korean inside the prompt).`;
}

function buildBriefText(brief: CreativeBrief, count: number): string {
  const lines: string[] = [];
  lines.push(`variants requested: ${count}`);
  lines.push(`mode: ${brief.mode}${brief.isEdit ? " (edit a provided reference photo)" : ""}`);
  if (brief.isEdit) lines.push("input image: a base reference photo to transform (preserve subject).");
  if (brief.hasLogo) lines.push("input image: the brand logo — integrate naturally and keep it undistorted/legible.");
  lines.push(`aspect ratio: ${brief.aspectRatio}`);
  lines.push(`concept / scene: ${brief.concept.trim()}`);
  if (brief.keyMessage?.trim()) lines.push(`key message to communicate: ${brief.keyMessage.trim()}`);
  if (brief.tone?.trim()) lines.push(`tone: ${brief.tone.trim()}`);
  if (brief.brandHint?.trim()) lines.push(`brand cues: ${brief.brandHint.trim()}`);
  if (brief.designRef) lines.push(`design reference (mimic this style): ${formatDesignReference(brief.designRef)}`);

  const c = brief.copy;
  if (c && (c.headline || c.sub || c.cta)) {
    const copyParts = [
      c.headline ? `headline "${c.headline}"` : null,
      c.sub ? `sub "${c.sub}"` : null,
      c.cta ? `cta "${c.cta}"` : null,
    ].filter(Boolean);
    if (brief.mode === "overlay") {
      lines.push(
        `copy that will be overlaid LATER (do NOT draw it; reserve space for it): ${copyParts.join(", ")}`,
      );
    } else {
      lines.push(`Korean text to render in the image: ${copyParts.join(", ")}`);
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
