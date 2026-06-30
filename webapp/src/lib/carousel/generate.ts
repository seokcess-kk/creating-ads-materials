import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { generateImage } from "@/lib/engines";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBuffer } from "@/lib/utils/image-fetch";
import { extractNoticeMeta } from "@/lib/notice/extract";
import type { NoticeMeta } from "@/lib/notice/types";
import type { DesignReference } from "@/lib/generate/types";
import { anyNeedsOverlay } from "@/lib/text/bake-policy";
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
  fullSlideFallbackPrompt,
  fullSlideOverlayConfig,
  slideConfig,
} from "./render";
import { buildCarouselBackgroundPrompts, type CarouselStyleKnobs } from "./art-director";
import { getTemplate } from "./templates";
import { resolveStyle } from "./style";
import { setSlideRendered } from "./queries";
import type {
  BundleConcept,
  SlideDetail,
  CarouselBgMode,
  CarouselContentMode,
  CarouselRenderMode,
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

/**
 * 유효 렌더 모드 해결 — 사용자가 'full'(AI 일체형 시안)을 골랐어도, 공지·정보형이거나 슬라이드
 * 카피에 정확한 날짜·금액·퍼센트·연락처나 긴 본문이 있으면 'overlay'(후합성)로 강등한다.
 * 정확 데이터를 모델에 구우면 오타·날조 위험이 크고 수정·현지화도 불가하기 때문(가이드 근거).
 * 'overlay' 선택은 그대로 둔다. 슬라이드 단위가 아닌 번들 단위로 일관 적용(세트감 유지).
 */
export function resolveCarouselRenderMode(
  requested: CarouselRenderMode,
  contentMode: CarouselContentMode,
  details: SlideDetail[],
): CarouselRenderMode {
  if (requested !== "full") return requested;
  if (contentMode === "notice") return "overlay";
  const hasCritical = details.some((d) =>
    anyNeedsOverlay(d.headline, d.body, d.kicker),
  );
  return hasCritical ? "overlay" : "full";
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
  renderMode: CarouselRenderMode;
  toneOverride?: string | null;
  /** 사용자 구조화 스타일 노브(선택) — 아트디렉터 styleLock에 주입 */
  styleKnobs?: CarouselStyleKnobs | null;
  /** 레퍼런스 디자인 요소(있으면 배경 styleLock 기반으로 주입) */
  designRef?: DesignReference | null;
  /** shared 모드에서 기존 배경 재사용(재생성 시) */
  sharedBgUrl?: string | null;
  /** 슬라이드 index → DB 행 id (점진 업데이트 대상) */
  rowIdByIndex: Map<number, string>;
}): Promise<{ bgUrl: string | null }> {
  const total = params.details.length;
  const isFull = params.renderMode === "full";
  const template = getTemplate(params.concept.template);
  // 레퍼런스 있으면 레퍼런스가 색·폰트 주도, 없으면 템플릿(overlay 전용).
  const style = resolveStyle({ designRef: params.designRef, template });
  const fontSet = style.fontSet;

  // full=항상 슬라이드별 프롬프트 필요. overlay=per-slide거나 shared 신규일 때만.
  const needGen =
    isFull ||
    params.bgMode === "per-slide" ||
    (params.bgMode === "shared" && !params.sharedBgUrl);

  // 아트디렉터: full=텍스트까지 구운 슬라이드 프롬프트, overlay=텍스트 없는 배경. 실패 시 폴백.
  const ad = needGen
    ? await buildCarouselBackgroundPrompts({
        concept: params.concept,
        details: params.details,
        bgMode: params.bgMode,
        contentMode: params.contentMode,
        toneOverride: params.toneOverride,
        designRef: params.designRef,
        // 레퍼런스가 있으면 레퍼런스가 팔레트를 주도(템플릿 bgStyle은 레퍼런스 없을 때만).
        templateStyle: params.designRef ? null : template.bgStyle,
        styleKnobs: params.styleKnobs,
        textScheme: style.textScheme,
        renderMode: params.renderMode,
        usageContext: {
          operation: isFull ? "carousel_slide_full" : "carousel_art_director",
          brandId: params.brandId ?? null,
          metadata: {
            carouselId: params.carouselId,
            bgMode: params.bgMode,
            renderMode: params.renderMode,
          },
        },
      })
    : null;
  const promptByIndex = new Map<number, string>(
    (ad?.backgrounds ?? []).map((b) => [b.index, b.prompt]),
  );
  // full 폴백 프롬프트엔 공유 design system이 없어 슬라이드가 겉돈다 → styleLock 주입.
  const styleLock = ad?.styleLock?.trim() ?? "";

  // shared 배경(overlay 전용) — full 모드는 슬라이드별 완성형이라 공통 배경 없음.
  let sharedBgBuf: Buffer | null = null;
  let sharedBgUrl: string | null = params.sharedBgUrl ?? null;
  if (!isFull && params.bgMode === "shared") {
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

  // 슬라이드 렌더(동시성 캡5 — ≤5장이면 한 웨이브). 완성 즉시 DB 갱신 → 폴링이 하나씩 채움.
  await mapWithConcurrency(params.details, 5, async (detail) => {
    const rowId = params.rowIdByIndex.get(detail.index);

    if (isFull) {
      // 모델이 텍스트까지 구운 완성형 슬라이드 — 컴포지터 오버레이 없음.
      let prompt = promptByIndex.get(detail.index);
      if (!prompt) {
        prompt = fullSlideFallbackPrompt(params.concept, detail);
        if (styleLock) {
          prompt += ` Shared design system across all slides (match exactly): ${styleLock}.`;
        }
      }
      const img = await generateImage({
        prompt,
        aspectRatio: "1:1",
        imageSize: "1K", // gpt-image-2 medium 품질 — high 대비 2~3배 빠름(1024px, 1080 인스타에 충분)
        usageContext: {
          operation: "carousel_slide_full",
          brandId: params.brandId ?? null,
          metadata: { carouselId: params.carouselId, idx: detail.index },
        },
      });
      // full도 페이지 번호는 굽지 않고 후합성(숫자 가독성·일관). 스크림 없이 슬로건만.
      const composedBuf = await renderComposite(
        Buffer.from(img.base64, "base64"),
        fullSlideOverlayConfig(detail.index, total, style),
      );
      const uploaded = await uploadBuffer(
        params.carouselId,
        `slide_${String(detail.index).padStart(2, "0")}`,
        composedBuf,
      );
      if (rowId) {
        await setSlideRendered(rowId, {
          bg_url: null, // full은 재사용 배경 없음 → 편집 시 재생성
          image_url: uploaded.url,
          image_path: uploaded.path,
        });
      }
      return;
    }

    // overlay: 텍스트 없는 배경 + 컴포지터 한글 오버레이
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
      ...slideConfig(detail, total, style),
    };
    const composed = await renderComposite(bgBuf, config);
    const uploaded = await uploadBuffer(
      params.carouselId,
      `slide_${String(detail.index).padStart(2, "0")}`,
      composed,
    );

    if (rowId) {
      await setSlideRendered(rowId, {
        bg_url: slideBgUrl,
        image_url: uploaded.url,
        image_path: uploaded.path,
      });
    }
  });

  return { bgUrl: isFull ? null : sharedBgUrl };
}

/** 카피 편집 후 단건 재합성(LLM 호출 없음 — 기존 배경 재사용). */
export async function recomposeSlide(params: {
  carouselId: string;
  bgUrl: string;
  total: number;
  templateId?: string | null;
  /** 레퍼런스 디자인 요소(있으면 색·폰트를 주도 — 생성 때와 동일 스타일 재현) */
  designRef?: DesignReference | null;
  slide: Pick<SlideDetail, "index" | "role" | "kicker" | "headline" | "body">;
}): Promise<{ image_url: string; image_path: string }> {
  const bgBuf = await fetchAsBuffer(params.bgUrl);
  const style = resolveStyle({
    designRef: params.designRef,
    template: getTemplate(params.templateId),
  });
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: style.fontSet,
    ...slideConfig(params.slide, params.total, style),
  };
  const composed = await renderComposite(bgBuf, config);
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slide.index).padStart(2, "0")}_${Date.now().toString(36)}`,
    composed,
  );
  return { image_url: uploaded.url, image_path: uploaded.path };
}

/**
 * full 모드 단건 재생성 — 카피 편집 후 그 슬라이드를 텍스트까지 다시 굽는다(이미지 모델 1회 호출).
 * overlay의 recomposeSlide와 달리 배경 재사용이 불가능하므로 슬라이드 전체를 재생성.
 */
export async function regenerateFullSlide(params: {
  carouselId: string;
  concept: BundleConcept | null;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  styleKnobs?: CarouselStyleKnobs | null;
  designRef?: DesignReference | null;
  brandId?: string | null;
  slide: SlideDetail;
  /** 슬라이드 총 개수 — 페이지 번호 후합성용. */
  total: number;
}): Promise<{ image_url: string; image_path: string }> {
  let prompt: string | null = null;
  if (params.concept) {
    const ad = await buildCarouselBackgroundPrompts({
      concept: params.concept,
      details: [params.slide],
      bgMode: "per-slide",
      contentMode: params.contentMode,
      toneOverride: params.toneOverride,
      designRef: params.designRef,
      templateStyle: null,
      styleKnobs: params.styleKnobs,
      renderMode: "full",
      usageContext: {
        operation: "carousel_slide_full_regen",
        brandId: params.brandId ?? null,
        metadata: { carouselId: params.carouselId, idx: params.slide.index },
      },
    });
    prompt =
      ad?.backgrounds.find((b) => b.index === params.slide.index)?.prompt ??
      ad?.backgrounds[0]?.prompt ??
      null;
  }
  if (!prompt) prompt = fullSlideFallbackPrompt(params.concept, params.slide);

  const img = await generateImage({
    prompt,
    aspectRatio: "1:1",
    imageSize: "1K", // full 단건 재생성도 medium 품질(생성 때와 동일)
    usageContext: {
      operation: "carousel_slide_full",
      brandId: params.brandId ?? null,
      metadata: { carouselId: params.carouselId, idx: params.slide.index },
    },
  });
  // full도 페이지 번호는 후합성(굽지 않음). 생성 때와 동일 스타일로 슬로건만.
  const style = resolveStyle({
    designRef: params.designRef ?? null,
    template: getTemplate(params.concept?.template),
  });
  const composedBuf = await renderComposite(
    Buffer.from(img.base64, "base64"),
    fullSlideOverlayConfig(params.slide.index, params.total, style),
  );
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slide.index).padStart(2, "0")}_${Date.now().toString(36)}`,
    composedBuf,
  );
  return { image_url: uploaded.url, image_path: uploaded.path };
}
