import { callClaude, extractToolUse } from "@/lib/engines/claude";
import {
  generateImage,
  editImage,
  type ImagePart,
  type ImageSize,
  type GeneratedImage,
  type GenerateImageInput,
} from "@/lib/engines";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBuffer, fetchAsBase64 } from "@/lib/utils/image-fetch";
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
 * 레퍼런스 이미지가 있으면 editImage로 그 픽셀을 gpt-image에 직접 참조시켜(색·구도·무드가
 * 텍스트 요약을 거치지 않고 강하게 반영된다) 새 이미지를 만든다. 없으면 일반 text-to-image.
 * 레퍼런스는 '스타일 참조'로만 쓰고, 구체 콘텐츠(피사체·사진·문구·로고) 복제는 프롬프트로 억제한다.
 * aspectRatio는 캐러셀 전용이라 1:1 고정.
 */
async function generateSlideImage(params: {
  prompt: string;
  referenceImage: ImagePart | null;
  imageSize: ImageSize;
  /** full 모드처럼 모델이 한글 텍스트를 구워야 하면 true — 레퍼런스의 글자는 복제 금지, 지정 한글만 렌더. */
  rendersText: boolean;
  usageContext: GenerateImageInput["usageContext"];
}): Promise<GeneratedImage> {
  const shared = {
    aspectRatio: "1:1" as const,
    imageSize: params.imageSize,
    usageContext: params.usageContext,
  };
  if (!params.referenceImage) {
    return generateImage({ prompt: params.prompt, ...shared });
  }
  const guard = params.rendersText
    ? "\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood, composition and typographic feel so this slide reads as designed after it. Build an ENTIRELY NEW slide: do NOT copy its subjects, objects, photos, logos, or ANY of its text/letters/numbers. Render ONLY the Korean text specified above."
    : "\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood and composition. Create an ENTIRELY NEW, fully TEXTLESS composition: do NOT copy its subjects, objects, photos, text, or logos.";
  return editImage({
    prompt: `${params.prompt}${guard}`,
    baseImage: params.referenceImage,
    ...shared,
  });
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
  /** 레퍼런스 이미지 원본 URL(있으면 gpt-image에 직접 참조시켜 색·구도·무드를 강반영) */
  referenceImageUrl?: string | null;
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
  // 레퍼런스 이미지를 1회만 받아 모든 슬라이드 생성에 재사용(gpt-image 직접 참조용). 실패 시 텍스트만.
  const referenceImage = params.referenceImageUrl
    ? await fetchAsBase64(params.referenceImageUrl).catch(() => null)
    : null;

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
      const bg = await generateSlideImage({
        prompt: sharedPrompt,
        referenceImage,
        imageSize: "2K",
        rendersText: false,
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
      const img = await generateSlideImage({
        prompt,
        referenceImage,
        imageSize: "1K", // gpt-image-2 medium 품질 — high 대비 2~3배 빠름(1024px, 1080 인스타에 충분)
        rendersText: true,
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
      const bg = await generateSlideImage({
        prompt,
        referenceImage,
        imageSize: "2K",
        rendersText: false,
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
  /** 레퍼런스 이미지 원본 URL(있으면 gpt-image에 직접 참조) */
  referenceImageUrl?: string | null;
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

  const referenceImage = params.referenceImageUrl
    ? await fetchAsBase64(params.referenceImageUrl).catch(() => null)
    : null;
  const img = await generateSlideImage({
    prompt,
    referenceImage,
    imageSize: "1K", // full 단건 재생성도 medium 품질(생성 때와 동일)
    rendersText: true,
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

type SlideCopy = { kicker?: string | null; headline: string; body?: string | null };

/** 변경된 필드만 "교체/삭제/추가" 영어 편집 지시문으로(가이드: 바꿀 것 하나 + 나머지 유지). */
function buildSlideCopyEditInstruction(prev: SlideCopy, next: SlideCopy): string {
  const norm = (s?: string | null) => (s ?? "").trim();
  const parts: string[] = [];
  const add = (label: string, o: string, n: string) => {
    if (o === n) return;
    if (o && n) parts.push(`replace the ${label} "${o}" with "${n}"`);
    else if (o && !n) parts.push(`remove the ${label} "${o}"`);
    else if (!o && n) parts.push(`add the ${label} "${n}" matching the existing typographic style`);
  };
  add("kicker label", norm(prev.kicker), norm(next.kicker));
  add("headline", norm(prev.headline), norm(next.headline));
  add("body text", norm(prev.body), norm(next.body));
  const changes = parts.length ? parts.join("; ") : "make no textual change";
  return `Edit this finished Korean Instagram card-news slide: ${changes}. Render any Korean with PERFECT, correct modern Hangul, matching the existing fonts and sizes. Keep the layout, colors, fonts, illustration, background, composition and spacing EXACTLY the same — change nothing else.`;
}

/**
 * full 모드 단건 카피 편집 — 이전에 구운 슬라이드를 base로 editImage("문구만 교체, 나머지 유지").
 * regenerateFullSlide(통째 재생성)와 달리 디자인을 보존한 채 글자만 바꾼다. 페이지번호는 재합성.
 * 소스 미확보/편집 실패 시 null(호출자가 regenerateFullSlide로 폴백).
 */
export async function editFullSlideCopy(params: {
  carouselId: string;
  sourceImageUrl: string;
  prev: SlideCopy;
  next: SlideCopy;
  designRef?: DesignReference | null;
  concept: BundleConcept | null;
  brandId?: string | null;
  total: number;
  slideIndex: number;
}): Promise<{ image_url: string; image_path: string } | null> {
  const base = await fetchAsBase64(params.sourceImageUrl).catch(() => null);
  if (!base) return null;
  const img = await editImage({
    prompt: buildSlideCopyEditInstruction(params.prev, params.next),
    baseImage: base,
    aspectRatio: "1:1",
    imageSize: "2K", // 편집은 최종물 → 고품질
    usageContext: {
      operation: "carousel_slide_full_edit",
      brandId: params.brandId ?? null,
      metadata: { carouselId: params.carouselId, idx: params.slideIndex },
    },
  });
  // 디자인은 base로 보존됨 — 페이지 번호만 깨끗이 재합성(생성 때와 동일 스타일).
  const style = resolveStyle({
    designRef: params.designRef ?? null,
    template: getTemplate(params.concept?.template),
  });
  const composed = await renderComposite(
    Buffer.from(img.base64, "base64"),
    fullSlideOverlayConfig(params.slideIndex, params.total, style),
  );
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slideIndex).padStart(2, "0")}_${Date.now().toString(36)}`,
    composed,
  );
  return { image_url: uploaded.url, image_path: uploaded.path };
}

/**
 * full(베이킹) 슬라이드를 overlay로 변환 — 텍스트 없는 배경을 생성하고 컴포지터로 한글을 얹는다.
 * 편집으로 정확 데이터(날짜·금액·연락처)가 들어왔을 때 호출: 모델이 글자를 굽지 않으므로
 * 숫자·날짜가 100% 정확하고, bg_url이 생겨 이후 편집은 recomposeSlide(모델 호출 없음)로 처리된다.
 * 스타일(팔레트·폰트·무드)은 styleLock/템플릿으로 유지하나, 텍스트는 벡터 폰트라 비주얼 결은 달라질 수 있다.
 */
export async function convertFullSlideToOverlay(params: {
  carouselId: string;
  concept: BundleConcept | null;
  contentMode: CarouselContentMode;
  toneOverride?: string | null;
  styleKnobs?: CarouselStyleKnobs | null;
  designRef?: DesignReference | null;
  /** 레퍼런스 이미지 원본 URL(있으면 gpt-image에 직접 참조) */
  referenceImageUrl?: string | null;
  brandId?: string | null;
  slide: SlideDetail;
  total: number;
}): Promise<{ bg_url: string; image_url: string; image_path: string }> {
  const template = getTemplate(params.concept?.template);
  const style = resolveStyle({ designRef: params.designRef ?? null, template });

  // 텍스트 없는 배경 프롬프트(스타일 일관) — 아트디렉터(overlay) 우선, 실패 시 폴백.
  let bgPrompt: string | null = null;
  if (params.concept) {
    const ad = await buildCarouselBackgroundPrompts({
      concept: params.concept,
      details: [params.slide],
      bgMode: "per-slide",
      contentMode: params.contentMode,
      toneOverride: params.toneOverride,
      designRef: params.designRef,
      templateStyle: params.designRef ? null : template.bgStyle,
      styleKnobs: params.styleKnobs,
      textScheme: style.textScheme,
      renderMode: "overlay",
      usageContext: {
        operation: "carousel_slide_to_overlay",
        brandId: params.brandId ?? null,
        metadata: { carouselId: params.carouselId, idx: params.slide.index },
      },
    });
    bgPrompt =
      ad?.backgrounds.find((b) => b.index === params.slide.index)?.prompt ??
      ad?.backgrounds[0]?.prompt ??
      null;
  }
  if (!bgPrompt) bgPrompt = perSlideBgPrompt(params.concept, params.slide);

  const referenceImage = params.referenceImageUrl
    ? await fetchAsBase64(params.referenceImageUrl).catch(() => null)
    : null;
  const bg = await generateSlideImage({
    prompt: bgPrompt,
    referenceImage,
    imageSize: "2K",
    rendersText: false,
    usageContext: {
      operation: "carousel_bg_slide",
      brandId: params.brandId ?? null,
      metadata: { carouselId: params.carouselId, idx: params.slide.index },
    },
  });
  const bgBuf = Buffer.from(bg.base64, "base64");
  const stamp = Date.now().toString(36);
  const bgUploaded = await uploadBuffer(
    params.carouselId,
    `bg_${String(params.slide.index).padStart(2, "0")}_${stamp}`,
    bgBuf,
  );

  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: style.fontSet,
    ...slideConfig(params.slide, params.total, style),
  };
  const composed = await renderComposite(bgBuf, config);
  const uploaded = await uploadBuffer(
    params.carouselId,
    `slide_${String(params.slide.index).padStart(2, "0")}_${stamp}`,
    composed,
  );
  return { bg_url: bgUploaded.url, image_url: uploaded.url, image_path: uploaded.path };
}
