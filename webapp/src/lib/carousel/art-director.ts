import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import type { UsageContext } from "@/lib/usage/record";
import { formatDesignReference } from "@/lib/generate/analyze-reference";
import type { DesignReference } from "@/lib/generate/types";
import type {
  BundleConcept,
  SlideDetail,
  CarouselBgMode,
  CarouselContentMode,
} from "./types";

const TOOL = "record_carousel_backgrounds";

/** 아트디렉터 산출물 — 전 슬라이드가 공유할 스타일 + 배경 프롬프트(인덱스별). */
export interface CarouselBgPrompts {
  /** 전 슬라이드가 공유하는 비주얼 스타일 한 줄(팔레트·라이팅·질감·무드). */
  styleLock: string;
  /** shared 모드는 index 0 한 개, per-slide 모드는 슬라이드 index별 1개. */
  backgrounds: { index: number; prompt: string }[];
}

const BgListSchema = z.object({
  styleLock: z.string().min(10).max(400),
  backgrounds: z
    .array(
      z.object({
        index: z.number().int().min(0),
        prompt: z.string().min(20).max(1000),
      }),
    )
    .min(1)
    .max(8),
});

function tool(): Tool {
  return {
    name: TOOL,
    description:
      "캐러셀 콘셉트와 슬라이드 계획을 gpt-image용 '텍스트 없는 배경' 프롬프트로 확장. 전 슬라이드가 하나의 styleLock(팔레트·무드)을 공유해 한 세트처럼 보이게 한다.",
    input_schema: {
      type: "object",
      properties: {
        styleLock: {
          type: "string",
          description:
            "모든 배경이 공유할 비주얼 스타일 한 줄(팔레트·라이팅·질감·무드·트리트먼트). 영어.",
        },
        backgrounds: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          description:
            "요청 수만큼의 배경 프롬프트. shared면 index 0 한 개, per-slide면 주어진 슬라이드 index마다 1개.",
          items: {
            type: "object",
            properties: {
              index: {
                type: "number",
                description: "shared는 0, per-slide는 해당 슬라이드 index(1-based).",
              },
              prompt: {
                type: "string",
                description:
                  "gpt-image에 보낼 영어 배경 프롬프트. 텍스트/숫자/로고 절대 금지, 한글 오버레이용 여백 확보.",
              },
            },
            required: ["index", "prompt"],
          },
        },
      },
      required: ["styleLock", "backgrounds"],
    },
  };
}

function buildSystem(
  isNotice: boolean,
  toneOverride: string | null | undefined,
  hasRef: boolean,
): string {
  const toneLine = isNotice
    ? "Notice/announcement: sober, trustworthy, restrained, institutional. Calm palette. Avoid hype, glow, gradients-as-decoration, or playful elements."
    : "Persuasion: modern, confident, visually engaging while staying clean and uncluttered.";
  const over = toneOverride?.trim()
    ? `\n- Tone override (highest priority): ${toneOverride.trim()}`
    : "";
  const refRule = hasRef
    ? `\n\nDESIGN REFERENCE (provided in the brief):\n- Treat the reference's palette / mood / composition / layout as a strong influence on the styleLock so the carousel feels designed after it.\n- Still obey every HARD RULE (textless, negative space, deep/dark enough for white text). Adapt the reference's look into clean textless backgrounds; do not copy any text or logos it may contain.`
    : "";
  return `You are an expert advertising ART DIRECTOR and prompt engineer for the "gpt-image" text-to-image model, specializing in BACKGROUNDS for Korean Instagram card-news carousels (1:1, 1080x1080).

You receive a carousel plan (concept + per-slide roles/motifs) and produce:
1) styleLock: ONE short shared visual-style line (palette, lighting, texture, mood, treatment) that ALL slides share so the carousel reads as a single cohesive set.
2) backgrounds: the requested number of CLEAN, TEXTLESS background prompts in English.

HARD RULES for every background prompt:
- The image MUST contain NO text, letters, numbers, words, or logos of any kind.
- Leave generous, calm NEGATIVE SPACE (especially the center and lower area) with good contrast, sized for Korean copy to be overlaid LATER. Do not fill the frame with busy detail.
- Keep backgrounds DEEP and DARK enough that WHITE overlay text stays readable — avoid bright or washed-out areas, especially in the center and lower third where the text sits.
- 1:1 square framing. No people holding/wearing readable text; no objects with readable text.
- Advertising-grade: intentional focal idea, clean professional finish. Not flashy clip-art.

COHESION:
- Every background must obey the same styleLock (same palette / lighting / treatment).
- For per-slide backgrounds, vary the composition and elements subtly to match each slide's role and motif, but keep the shared look. The hook slide can be the most striking; the cta slide should feel resolved and action-ready.
- For a single shared background, make one versatile composition that works behind any slide's text.

TONE:
- ${toneLine}${over}${refRule}

Reflect the carousel's bigIdea/coreMessage in the imagery (mood, metaphor, setting) WITHOUT ever rendering text.
Output ONLY via the ${TOOL} tool. Prompts must be in English.`;
}

function buildBrief(
  params: {
    concept: BundleConcept;
    details: SlideDetail[];
    bgMode: CarouselBgMode;
    designRef?: DesignReference | null;
    templateStyle?: string | null;
  },
  count: number,
): string {
  const c = params.concept;
  const tplLine = params.templateStyle
    ? `\n# TEMPLATE STYLE (use as the base palette/mood of the styleLock)\n${params.templateStyle}\n`
    : "";
  const refLine = params.designRef
    ? `\n# DESIGN REFERENCE (strong influence on the styleLock — adapt within the template's deep/dark regime)\n${formatDesignReference(params.designRef)}\n`
    : "";
  const slideLines = params.details
    .map((d) => {
      const motif = d.visual?.motif?.trim();
      const emph = d.visual?.emphasis;
      const parts = [
        `[${d.index}/${d.role}]`,
        d.headline ? `headline "${d.headline}"` : null,
        motif ? `motif: ${motif}` : null,
        emph ? `emphasis: ${emph}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const modeLine =
    params.bgMode === "shared"
      ? `mode: shared — produce EXACTLY ONE shared background with index 0 (it must work behind every slide).`
      : `mode: per-slide — produce ONE background per slide index listed below, using that exact index.`;

  return `${modeLine}
backgrounds requested: ${count}
${tplLine}${refLine}
# CAROUSEL CONCEPT
bigIdea: ${c.bigIdea}
coreMessage: ${c.coreMessage}
target: ${c.target}
tone: ${c.tone}
narrativeArc: ${c.narrativeArc}

# SLIDES (headlines are context for negative-space sizing only — do NOT render them)
${slideLines}

Produce styleLock + ${count} background prompt(s) via ${TOOL}.`;
}

/**
 * 콘셉트 + 슬라이드 → 텍스트 없는 배경 프롬프트(전 슬라이드 1콜, 스타일 통일).
 * 실패 시 null(호출자가 render.ts의 템플릿 프롬프트로 폴백).
 */
export async function buildCarouselBackgroundPrompts(params: {
  concept: BundleConcept;
  details: SlideDetail[];
  bgMode: CarouselBgMode;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  designRef?: DesignReference | null;
  /** 선택된 템플릿의 배경 스타일 가이드(styleLock 기반) */
  templateStyle?: string | null;
  usageContext?: UsageContext;
}): Promise<CarouselBgPrompts | null> {
  try {
    const isNotice = params.contentMode === "notice";
    const count = params.bgMode === "shared" ? 1 : params.details.length;
    const resp = await callClaude({
      model: "sonnet",
      maxTokens: Math.min(4000, 1000 + count * 400),
      system: buildSystem(isNotice, params.toneOverride, Boolean(params.designRef)),
      usageContext: params.usageContext,
      messages: [
        {
          role: "user",
          content: buildBrief(params, count),
        },
      ],
      tools: [tool()],
      toolChoice: { type: "tool", name: TOOL },
    });
    const raw = extractToolUse(resp, TOOL);
    if (!raw) return null;
    return BgListSchema.parse(raw);
  } catch (e) {
    console.warn(
      "캐러셀 아트디렉터 프롬프트 생성 실패(템플릿 폴백):",
      (e as Error).message,
    );
    return null;
  }
}
