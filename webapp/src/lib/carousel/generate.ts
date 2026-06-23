import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { generateImage } from "@/lib/engines";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { extractNoticeMeta } from "@/lib/notice/extract";
import type { NoticeMeta } from "@/lib/notice/types";
import {
  CONCEPT_TOOL_NAME,
  SLIDES_TOOL_NAME,
  BundleConceptSchema,
  SlideDetailListSchema,
  buildConceptSystem,
  buildConceptMessages,
  buildSlideDetailSystem,
  buildSlideDetailMessages,
  conceptTool,
  slidesTool,
} from "./prompts";
import {
  SHARED_BG_PROMPT,
  perSlideBgPrompt,
  carouselFontSet,
  slideConfig,
} from "./render";
import type {
  BundleConcept,
  SlideDetail,
  CarouselBgMode,
  CarouselContentMode,
} from "./types";

interface ClaudeContext {
  brandId?: string | null;
  carouselId?: string | null;
}

async function maybeExtractNotice(
  rawContent: string,
  contentMode: CarouselContentMode,
  preset: NoticeMeta | null | undefined,
  ctx: ClaudeContext,
): Promise<NoticeMeta | null> {
  if (contentMode !== "notice") return null;
  if (preset) return preset;
  try {
    return await extractNoticeMeta(rawContent, {
      operation: "carousel_notice_extract",
      brandId: ctx.brandId ?? null,
      metadata: { carouselId: ctx.carouselId ?? null },
    });
  } catch {
    return null;
  }
}

/** 1단계 — 번들 기획(콘셉트/서사) 생성. */
export async function generateBundleConcept(params: {
  rawContent: string;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  brandName?: string | null;
  noticeMeta?: NoticeMeta | null;
  brandId?: string | null;
  carouselId?: string | null;
}): Promise<{ concept: BundleConcept; noticeMeta: NoticeMeta | null }> {
  const raw = params.rawContent?.trim();
  if (!raw) throw new Error("원문(rawContent)이 없습니다");
  const isNotice = params.contentMode === "notice";

  const noticeMeta = await maybeExtractNotice(raw, params.contentMode, params.noticeMeta, params);

  const resp = await callClaude({
    model: "opus",
    maxTokens: 2000,
    system: buildConceptSystem({ isNotice, toneOverride: params.toneOverride }),
    usageContext: {
      operation: "carousel_concept",
      brandId: params.brandId ?? null,
      metadata: { carouselId: params.carouselId ?? null },
    },
    messages: buildConceptMessages({
      rawContent: raw,
      noticeMeta,
      brandName: params.brandName,
    }),
    tools: [conceptTool],
    toolChoice: { type: "tool", name: CONCEPT_TOOL_NAME },
  });
  const rawConcept = extractToolUse(resp, CONCEPT_TOOL_NAME);
  if (!rawConcept) throw new Error("캐러셀 기획 생성 실패");
  const concept = BundleConceptSchema.parse(rawConcept);
  return { concept, noticeMeta };
}

/** 2단계 — 확정된 기획을 슬라이드 상세 카피로 구체화. */
export async function generateSlideDetails(params: {
  rawContent: string;
  concept: BundleConcept;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  noticeMeta?: NoticeMeta | null;
  brandName?: string | null;
  brandId?: string | null;
  carouselId?: string | null;
}): Promise<SlideDetail[]> {
  const isNotice = params.contentMode === "notice";
  const resp = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: buildSlideDetailSystem({ isNotice, toneOverride: params.toneOverride }),
    usageContext: {
      operation: "carousel_slides",
      brandId: params.brandId ?? null,
      metadata: { carouselId: params.carouselId ?? null },
    },
    messages: buildSlideDetailMessages({
      conceptJson: JSON.stringify(params.concept, null, 2),
      rawContent: params.rawContent.trim(),
      noticeMeta: params.noticeMeta,
      brandName: params.brandName,
    }),
    tools: [slidesTool],
    toolChoice: { type: "tool", name: SLIDES_TOOL_NAME },
  });
  const raw = extractToolUse(resp, SLIDES_TOOL_NAME);
  if (!raw) throw new Error("슬라이드 상세 생성 실패");
  const { slides } = SlideDetailListSchema.parse(raw);
  return [...slides].sort((a, b) => a.index - b.index);
}

async function uploadBuffer(
  carouselId: string,
  label: string,
  buf: Buffer,
): Promise<{ url: string; path: string }> {
  return uploadGeneratedImage(carouselId, label, {
    mimeType: "image/png",
    base64: buf.toString("base64"),
  });
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`배경 이미지 fetch 실패: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export interface RenderedSlide extends SlideDetail {
  bg_url: string | null;
  image_url: string;
  image_path: string;
}

/** 슬라이드 상세 → 배경(shared/per-slide) → renderComposite → 업로드. */
export async function renderCarouselSlides(params: {
  carouselId: string;
  brandId?: string | null;
  concept: BundleConcept;
  details: SlideDetail[];
  bgMode: CarouselBgMode;
  /** shared 모드에서 기존 배경 재사용(재생성 시) */
  sharedBgUrl?: string | null;
}): Promise<{ bgUrl: string | null; slides: RenderedSlide[] }> {
  const total = params.details.length;
  const fontSet = carouselFontSet();

  // shared 배경 1장 준비(재사용 또는 신규 생성)
  let sharedBgBuf: Buffer | null = null;
  let sharedBgUrl: string | null = params.sharedBgUrl ?? null;
  if (params.bgMode === "shared") {
    if (sharedBgUrl) {
      sharedBgBuf = await fetchBuffer(sharedBgUrl);
    } else {
      const bg = await generateImage({
        prompt: SHARED_BG_PROMPT,
        aspectRatio: "1:1",
        imageSize: "2K",
        usageContext: {
          operation: "carousel_bg_shared",
          brandId: params.brandId ?? null,
          metadata: { carouselId: params.carouselId },
        },
      });
      sharedBgBuf = Buffer.from(bg.base64, "base64");
      const uploaded = await uploadBuffer(params.carouselId, "bg", sharedBgBuf);
      sharedBgUrl = uploaded.url;
    }
  }

  const slides: RenderedSlide[] = [];
  for (const detail of params.details) {
    let bgBuf: Buffer;
    let slideBgUrl: string | null;
    if (params.bgMode === "per-slide") {
      const bg = await generateImage({
        prompt: perSlideBgPrompt(params.concept, detail),
        aspectRatio: "1:1",
        imageSize: "2K",
        usageContext: {
          operation: "carousel_bg_slide",
          brandId: params.brandId ?? null,
          metadata: { carouselId: params.carouselId, idx: detail.index },
        },
      });
      bgBuf = Buffer.from(bg.base64, "base64");
      const uploaded = await uploadBuffer(
        params.carouselId,
        `bg_${String(detail.index).padStart(2, "0")}`,
        bgBuf,
      );
      slideBgUrl = uploaded.url;
    } else {
      bgBuf = sharedBgBuf as Buffer;
      slideBgUrl = sharedBgUrl;
    }

    const config: ComposeConfig = {
      backgroundImageUrl: "",
      output: { bucket: "", path: "" },
      fontSet,
      ...slideConfig(detail, total),
    };
    const composed = await renderComposite(bgBuf, config);
    const uploaded = await uploadBuffer(
      params.carouselId,
      `slide_${String(detail.index).padStart(2, "0")}`,
      composed,
    );

    slides.push({
      ...detail,
      bg_url: slideBgUrl,
      image_url: uploaded.url,
      image_path: uploaded.path,
    });
  }

  return { bgUrl: sharedBgUrl, slides };
}

/** 카피 편집 후 단건 재합성(LLM 호출 없음 — 기존 배경 재사용). */
export async function recomposeSlide(params: {
  carouselId: string;
  bgUrl: string;
  total: number;
  slide: Pick<SlideDetail, "index" | "role" | "kicker" | "headline" | "body">;
}): Promise<{ image_url: string; image_path: string }> {
  const bgBuf = await fetchBuffer(params.bgUrl);
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: carouselFontSet(),
    ...slideConfig(params.slide, params.total),
  };
  const composed = await renderComposite(bgBuf, config);
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slide.index).padStart(2, "0")}_${Date.now().toString(36)}`,
    composed,
  );
  return { image_url: uploaded.url, image_path: uploaded.path };
}
