import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { generateImage } from "@/lib/engines";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBuffer } from "@/lib/utils/image-fetch";
import { extractNoticeMeta } from "@/lib/notice/extract";
import type { NoticeMeta } from "@/lib/notice/types";
import type { DesignReference } from "@/lib/generate/types";
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
import { buildCarouselBackgroundPrompts } from "./art-director";
import { getTemplate } from "./templates";
import { setSlideRendered } from "./queries";
import type {
  BundleConcept,
  SlideDetail,
  CarouselBgMode,
  CarouselContentMode,
} from "./types";

/** 순서 보존 + 동시성 제한 map(이미지 모델 동시 호출 폭주 방지). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

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

/**
 * 슬라이드 상세 → 배경(shared/per-slide) → renderComposite → 업로드.
 * 완성되는 대로 각 슬라이드 행(rowIdByIndex)을 점진 기록 → 클라이언트 폴링이 하나씩 채움.
 */
export async function renderCarouselSlides(params: {
  carouselId: string;
  brandId?: string | null;
  concept: BundleConcept;
  details: SlideDetail[];
  bgMode: CarouselBgMode;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  /** 레퍼런스 디자인 요소(있으면 배경 styleLock 기반으로 주입) */
  designRef?: DesignReference | null;
  /** shared 모드에서 기존 배경 재사용(재생성 시) */
  sharedBgUrl?: string | null;
  /** 슬라이드 index → DB 행 id (점진 업데이트 대상) */
  rowIdByIndex: Map<number, string>;
}): Promise<{ bgUrl: string | null }> {
  const total = params.details.length;
  const fontSet = carouselFontSet();
  const template = getTemplate(params.concept.template);

  // 배경 생성이 필요할 때만 아트디렉터 호출(shared 재사용 시 생략).
  const needGen =
    params.bgMode === "per-slide" ||
    (params.bgMode === "shared" && !params.sharedBgUrl);

  // 아트디렉터: 콘셉트+슬라이드 → 텍스트 없는 배경 프롬프트(전 슬라이드 1콜, 스타일 통일).
  // 실패 시 null → render.ts 템플릿 프롬프트로 폴백.
  const ad = needGen
    ? await buildCarouselBackgroundPrompts({
        concept: params.concept,
        details: params.details,
        bgMode: params.bgMode,
        contentMode: params.contentMode,
        toneOverride: params.toneOverride,
        designRef: params.designRef,
        templateStyle: template.bgStyle,
        usageContext: {
          operation: "carousel_art_director",
          brandId: params.brandId ?? null,
          metadata: { carouselId: params.carouselId, bgMode: params.bgMode },
        },
      })
    : null;
  const promptByIndex = new Map<number, string>(
    (ad?.backgrounds ?? []).map((b) => [b.index, b.prompt]),
  );

  // shared 배경 1장 준비(재사용 또는 신규 생성)
  let sharedBgBuf: Buffer | null = null;
  let sharedBgUrl: string | null = params.sharedBgUrl ?? null;
  if (params.bgMode === "shared") {
    if (sharedBgUrl) {
      sharedBgBuf = await fetchAsBuffer(sharedBgUrl);
    } else {
      const sharedPrompt = ad?.backgrounds[0]?.prompt ?? SHARED_BG_PROMPT;
      const bg = await generateImage({
        prompt: sharedPrompt,
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

  // 슬라이드 렌더 — per-slide 배경 생성/합성을 동시성 캡(4)으로 병렬화.
  // 각 슬라이드가 끝나는 즉시 DB 행을 갱신 → 폴링 클라이언트가 하나씩 채워 본다.
  await mapWithConcurrency(params.details, 4, async (detail) => {
    let bgBuf: Buffer;
    let slideBgUrl: string | null;
    if (params.bgMode === "per-slide") {
      const prompt =
        promptByIndex.get(detail.index) ??
        perSlideBgPrompt(params.concept, detail);
      const bg = await generateImage({
        prompt,
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
      ...slideConfig(detail, total, template),
    };
    const composed = await renderComposite(bgBuf, config);
    const uploaded = await uploadBuffer(
      params.carouselId,
      `slide_${String(detail.index).padStart(2, "0")}`,
      composed,
    );

    const rowId = params.rowIdByIndex.get(detail.index);
    if (rowId) {
      await setSlideRendered(rowId, {
        bg_url: slideBgUrl,
        image_url: uploaded.url,
        image_path: uploaded.path,
      });
    }
  });

  return { bgUrl: sharedBgUrl };
}

/** 카피 편집 후 단건 재합성(LLM 호출 없음 — 기존 배경 재사용). */
export async function recomposeSlide(params: {
  carouselId: string;
  bgUrl: string;
  total: number;
  templateId?: string | null;
  slide: Pick<SlideDetail, "index" | "role" | "kicker" | "headline" | "body">;
}): Promise<{ image_url: string; image_path: string }> {
  const bgBuf = await fetchAsBuffer(params.bgUrl);
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: carouselFontSet(),
    ...slideConfig(params.slide, params.total, getTemplate(params.templateId)),
  };
  const composed = await renderComposite(bgBuf, config);
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slide.index).padStart(2, "0")}_${Date.now().toString(36)}`,
    composed,
  );
  return { image_url: uploaded.url, image_path: uploaded.path };
}
