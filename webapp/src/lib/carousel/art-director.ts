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
  CarouselRenderMode,
} from "./types";

const TOOL = "record_carousel_backgrounds";

/** 아트디렉터 산출물 — 전 슬라이드가 공유할 스타일 + 배경 프롬프트(인덱스별). */
export interface CarouselBgPrompts {
  /** 전 슬라이드가 공유하는 비주얼 스타일 한 줄(팔레트·라이팅·질감·무드). */
  styleLock: string;
  /** shared 모드는 index 0 한 개, per-slide 모드는 슬라이드 index별 1개. */
  backgrounds: { index: number; prompt: string }[];
}

const BgItemSchema = z.object({
  index: z.number().int().min(0),
  prompt: z.string().min(20).max(2000),
});
const BgListSchema = z.object({
  styleLock: z.string().min(10).max(400),
  backgrounds: z.array(BgItemSchema).min(1).max(8),
});

/**
 * 관용 파싱 — 프롬프트 1개가 너무 길거나 형식이 어긋나도 전체를 버리지 않고,
 * 유효한 배경만 살린다(빠진 슬라이드는 호출자가 per-index 폴백). 살릴 게 없으면 null.
 */
function parseBgPrompts(raw: unknown): CarouselBgPrompts | null {
  const strict = BgListSchema.safeParse(raw);
  if (strict.success) return strict.data;
  const obj = (raw ?? {}) as { styleLock?: unknown; backgrounds?: unknown };
  const styleLock = typeof obj.styleLock === "string" ? obj.styleLock : "";
  const items = Array.isArray(obj.backgrounds) ? obj.backgrounds : [];
  const backgrounds = items
    .map((i) => BgItemSchema.safeParse(i))
    .filter((r): r is { success: true; data: { index: number; prompt: string } } => r.success)
    .map((r) => r.data);
  if (!backgrounds.length) return null;
  return { styleLock, backgrounds };
}

function tool(renderMode: CarouselRenderMode): Tool {
  const isFull = renderMode === "full";
  return {
    name: TOOL,
    description: isFull
      ? "캐러셀 콘셉트+슬라이드를 gpt-image용 '완성형 슬라이드 프롬프트'(배경+레이아웃+한글 텍스트까지 디자인)로 확장. 전 슬라이드가 하나의 design system을 공유해 한 세트로 보이게 한다."
      : "캐러셀 콘셉트와 슬라이드 계획을 gpt-image용 '텍스트 없는 배경' 프롬프트로 확장. 전 슬라이드가 하나의 styleLock(팔레트·무드)을 공유해 한 세트처럼 보이게 한다.",
    input_schema: {
      type: "object",
      properties: {
        styleLock: {
          type: "string",
          description: isFull
            ? "모든 슬라이드가 공유할 design system 한 줄(팔레트·타이포·레이아웃 그리드·장식·무드). 영어."
            : "모든 배경이 공유할 비주얼 스타일 한 줄(팔레트·라이팅·질감·무드·트리트먼트). 영어.",
        },
        backgrounds: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          description: isFull
            ? "요청 수만큼의 완성형 슬라이드 프롬프트. 주어진 슬라이드 index마다 1개."
            : "요청 수만큼의 배경 프롬프트. shared면 index 0 한 개, per-slide면 주어진 슬라이드 index마다 1개.",
          items: {
            type: "object",
            properties: {
              index: {
                type: "number",
                description: isFull
                  ? "해당 슬라이드 index(1-based)."
                  : "shared는 0, per-slide는 해당 슬라이드 index(1-based).",
              },
              prompt: {
                type: "string",
                description: isFull
                  ? "gpt-image에 보낼 영어 프롬프트. 주어진 한글 텍스트를 정확히 렌더(왜곡·오타·창작 금지), 강한 타이포 위계와 레이아웃. 로고/워드마크 금지."
                  : "gpt-image에 보낼 영어 배경 프롬프트. 텍스트/숫자/로고 절대 금지, 한글 오버레이용 여백 확보.",
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
  textScheme: "light" | "dark",
  renderMode: CarouselRenderMode,
): string {
  const toneLine = isNotice
    ? "Notice/announcement: sober, trustworthy, restrained, institutional. Calm palette. Avoid hype, glow, gradients-as-decoration, or playful elements."
    : "Persuasion: modern, confident, visually engaging while staying clean and uncluttered.";
  const over = toneOverride?.trim()
    ? `\n- Tone override (highest priority): ${toneOverride.trim()}`
    : "";

  // ── full 모드: 모델이 텍스트까지 구운 완성형 디자인 슬라이드 ──
  if (renderMode === "full") {
    const fullRef = hasRef
      ? `\n\nDESIGN REFERENCE (in the brief): follow its palette / mood / composition / layout / typography CLOSELY as the shared design system. Do NOT copy any logo or wordmark it contains.`
      : "";
    return `You are an expert advertising ART DIRECTOR + prompt engineer for the "gpt-image" text-to-image model. You design COMPLETE Korean Instagram card-news slides (1:1, 1080x1080) — background, layout, AND typeset Korean text together, like a real graphic designer.

You produce:
1) styleLock: ONE shared DESIGN SYSTEM line that EVERY slide reuses so the carousel reads as one cohesive set — it MUST name a medium/style token, a LIMITED palette (2-3 named colors), explicit lighting, type style, layout grid, decorative motifs and mood.
2) slides: ONE prompt per slide that RENDERS that slide's given Korean text as a polished designed slide.

HARD RULES (Korean text rendering is the #1 priority):
- Begin EVERY slide prompt with the styleLock's medium/style token (so all slides read as ONE set), then the slide's scene/subject, then the typeset Korean text.
- RENDER the given Korean text IN the image with PERFECT, correct modern Hangul. Use ONLY the exact Korean strings provided — never distort, misspell, translate, or invent characters, and add no extra text/captions/lorem.
- Strong typographic hierarchy: kicker small, headline dominant and large, body smaller. Real editorial layout (grid, alignment, generous whitespace) — NOT just centered text on a photo.
- Integrate text WITH the imagery (text panels, color blocks, intentional placement), not text floating over a busy photo. Ensure high text contrast.
- EVERY slide reuses the SAME design system (palette, type feel, layout structure, decorative elements) per styleLock — vary the content/scene per slide, never the system. The 5 slides must look like ONE set.
- On-topic, concrete subject imagery tied to the product/topic and each slide's motif (coffee brand → espresso/latte/cafe; gym → training). Relevant beats abstract.
- 1:1 framing. NO brand logo or wordmark (composited separately). Advertising-grade, premium, clean.
- If text might garble, prefer fewer words, larger — legibility over density.

TONE:
- ${toneLine}${over}${fullRef}

Output ONLY via the ${TOOL} tool. Prompt text (design directions) in English; the Korean strings to render stay in Korean.`;
  }

  const readabilityRule =
    textScheme === "dark"
      ? "Keep the reserved text zone BRIGHT, LIGHT and airy so DARK overlay text stays readable there; overall palette stays light/clean — no dark or busy patches where the text sits."
      : "Keep the reserved text zone DEEP and DARK enough that WHITE/light overlay text stays readable there — no bright or washed-out patches where the text sits.";
  const refRule = hasRef
    ? `\n\nDESIGN REFERENCE (provided in the brief):\n- Follow the reference's palette / mood / composition / layout CLOSELY as the foundation of the styleLock, so the carousel feels designed after it.\n- Still obey every HARD RULE (textless, reserved readable text zone). Do not copy any text or logos the reference may contain.`
    : "";
  return `You are an expert advertising ART DIRECTOR and prompt engineer for the "gpt-image" text-to-image model, specializing in BACKGROUNDS for Korean Instagram card-news carousels (1:1, 1080x1080).

You receive a carousel plan (concept + per-slide roles/motifs) and produce:
1) styleLock: ONE short shared visual-style line that ALL slides share so the carousel reads as a single cohesive set — it MUST name a medium/style token, a LIMITED palette (2-3 named colors), explicit lighting, texture, mood and treatment.
2) backgrounds: the requested number of CLEAN, TEXTLESS background prompts in English.

HARD RULES for every background prompt:
- Begin EVERY background prompt with the styleLock's medium/style token, then the scene/composition, then the reserved text zone, then exclusions — so all slides read as ONE set.
- The image MUST contain NO text, letters, numbers, words, or logos of any kind.
- Reserve ONE clean, low-detail area (center or lower third) for the Korean copy overlaid LATER — keep that zone calm and uncluttered even if the rest of the frame carries subject imagery.
- ${readabilityRule}
- 1:1 square framing. No people holding/wearing readable text; no objects with readable text.
- Advertising-grade: intentional focal idea, clean professional finish. Not flashy clip-art.

SUBJECT MATTER (make it relatable):
- Depict concrete, on-topic imagery tied to the carousel's product/topic and each slide's motif (e.g., a coffee brand → an espresso pour, latte art, a warm cafe scene; a gym → training, equipment). Relevant, tangible subject matter beats abstract gradients.
- Keep the subject world cohesive across slides; vary the scene per slide's motif.

COHESION:
- Every background must obey the same styleLock (same palette / lighting / treatment).
- For per-slide backgrounds, vary the composition and elements subtly to match each slide's role and motif, but keep the shared look. The hook slide can be the most striking; the cta slide should feel resolved and action-ready.
- For a single shared background, make one versatile composition that works behind any slide's text.

TONE:
- ${toneLine}${over}${refRule}

AVOID BANNER-BLINDNESS:
- Do NOT look like a generic, obvious advertising banner. Feel native and editorial — like premium, organic feed content, not a hard-sell ad. Use crisp, intentional imagery that fits a real brand's world.

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
    renderMode?: CarouselRenderMode;
  },
  count: number,
): string {
  const c = params.concept;
  const isFull = params.renderMode === "full";
  const tplLine = params.templateStyle
    ? `\n# TEMPLATE STYLE (use as the base palette/mood of the styleLock)\n${params.templateStyle}\n`
    : "";
  const refLine = params.designRef
    ? `\n# DESIGN REFERENCE (follow this closely as the styleLock foundation — palette/mood/composition${isFull ? "/typography" : ""})\n${formatDesignReference(params.designRef)}\n`
    : "";

  const slideLines = params.details
    .map((d) => {
      const motif = d.visual?.motif?.trim();
      const emph = d.visual?.emphasis;
      if (isFull) {
        // full: 렌더할 정확한 한글 텍스트를 슬라이드별로 전달.
        const parts = [
          `[${d.index}/${d.role}]`,
          d.kicker ? `kicker "${d.kicker}"` : null,
          `headline "${d.headline}"`,
          d.body ? `body "${d.body}"` : null,
          motif ? `scene: ${motif}` : null,
          emph ? `emphasis: ${emph}` : null,
        ].filter(Boolean);
        return `- ${parts.join(" | ")}`;
      }
      const parts = [
        `[${d.index}/${d.role}]`,
        d.headline ? `headline "${d.headline}"` : null,
        motif ? `motif: ${motif}` : null,
        emph ? `emphasis: ${emph}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  if (isFull) {
    return `mode: full — produce ONE complete designed-slide prompt per slide index below, using that exact index. Each prompt RENDERS that slide's exact Korean text.
slides requested: ${count}
${tplLine}${refLine}
# CAROUSEL CONCEPT (ground the imagery in this product/topic)
bigIdea: ${c.bigIdea}
coreMessage: ${c.coreMessage}
target: ${c.target}
tone: ${c.tone}
narrativeArc: ${c.narrativeArc}

# SLIDES (RENDER each slide's EXACT Korean text — kicker/headline/body verbatim)
${slideLines}

Produce styleLock + ${count} slide prompt(s) via ${TOOL}.`;
  }

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
  /** 오버레이 텍스트 색 계열 — 배경의 텍스트 영역 명도를 맞추기 위해 */
  textScheme?: "light" | "dark";
  /** full = 텍스트까지 구운 완성형 슬라이드 프롬프트 / overlay(기본) = 텍스트 없는 배경 */
  renderMode?: CarouselRenderMode;
  usageContext?: UsageContext;
}): Promise<CarouselBgPrompts | null> {
  try {
    const isNotice = params.contentMode === "notice";
    const renderMode = params.renderMode ?? "overlay";
    // full은 슬라이드별로 1개씩(텍스트 렌더), overlay는 shared면 1개.
    const count =
      renderMode === "full" || params.bgMode !== "shared"
        ? params.details.length
        : 1;
    const resp = await callClaude({
      model: "sonnet",
      maxTokens: Math.min(6000, 1500 + count * 700),
      system: buildSystem(
        isNotice,
        params.toneOverride,
        Boolean(params.designRef),
        params.textScheme ?? "light",
        renderMode,
      ),
      usageContext: params.usageContext,
      messages: [
        {
          role: "user",
          content: buildBrief(params, count),
        },
      ],
      tools: [tool(renderMode)],
      toolChoice: { type: "tool", name: TOOL },
    });
    const raw = extractToolUse(resp, TOOL);
    if (!raw) return null;
    return parseBgPrompts(raw);
  } catch (e) {
    console.warn(
      "캐러셀 아트디렉터 프롬프트 생성 실패(템플릿 폴백):",
      (e as Error).message,
    );
    return null;
  }
}
