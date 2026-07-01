import { z } from "zod";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import {
  recomposeSlide,
  regenerateFullSlide,
  editFullSlideCopy,
  convertFullSlideToOverlay,
} from "@/lib/carousel/generate";
import {
  getCarousel,
  updateSlideCopy,
  updateSlideImage,
} from "@/lib/carousel/queries";
import { BundleConceptSchema } from "@/lib/carousel/prompts";
import { DesignReferenceSchema } from "@/lib/generate/analyze-reference";
import { anyNeedsOverlay } from "@/lib/text/bake-policy";
import type { SlideVisual } from "@/lib/carousel/types";

export const maxDuration = 180;

const PatchSchema = z.object({
  kicker: z.string().max(24).nullable().optional(),
  headline: z.string().min(1).max(30).optional(),
  body: z.string().max(90).nullable().optional(),
});

/** 카피 인라인 편집 → 재합성. overlay=기존 배경 재사용(LLM 없음), full=슬라이드 재생성(이미지 모델 1회). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ carouselId: string; idx: string }> },
) {
  try {
    const { carouselId, idx } = await params;
    const slideIdx = Number(idx);
    if (!Number.isInteger(slideIdx)) throw new ApiError(400, "잘못된 슬라이드 인덱스");
    const patch = await parseJson(request, PatchSchema);

    const data = await getCarousel(carouselId);
    if (!data) throw new ApiError(404, "캐러셀을 찾을 수 없습니다");
    const slide = data.slides.find((s) => s.idx === slideIdx);
    if (!slide) throw new ApiError(404, "슬라이드를 찾을 수 없습니다");

    const updated = await updateSlideCopy(slide.id, patch);

    const conceptParsed = BundleConceptSchema.safeParse(
      data.carousel.concept_json,
    );
    const refParsed = DesignReferenceSchema.safeParse(
      data.carousel.reference_json,
    );
    const designRef = refParsed.success ? refParsed.data : null;

    const concept = conceptParsed.success ? conceptParsed.data : null;
    const slideCopy = {
      index: updated.idx,
      role: updated.role,
      kicker: updated.kicker ?? undefined,
      headline: updated.headline,
      body: updated.body ?? undefined,
    };

    // (1) 보존 배경이 있는 슬라이드(원래 overlay이거나 정확데이터로 overlay 변환됨) →
    //     기존 배경으로 재합성(이미지 모델 호출 없음 · 텍스트 100% 정확).
    const slideBg =
      updated.bg_url ??
      (data.carousel.render_mode === "overlay" ? data.carousel.bg_url : null);
    if (slideBg) {
      const { image_url, image_path } = await recomposeSlide({
        carouselId,
        bgUrl: slideBg,
        total: data.slides.length,
        templateId: concept?.template ?? null,
        designRef,
        slide: slideCopy,
      });
      const finalRow = await updateSlideImage(slide.id, { image_url, image_path });
      return ok({ slide: finalRow });
    }

    // 여기는 full(베이킹) 슬라이드(보존 배경 없음).
    if (data.carousel.render_mode === "full") {
      const vj = updated.visual_json as Partial<SlideVisual>;
      const visual: SlideVisual | undefined = vj.motif
        ? { motif: vj.motif, emphasis: vj.emphasis ?? "keyword" }
        : undefined;
      const styleKnobs = {
        lighting: data.carousel.style_lighting,
        palette: data.carousel.style_palette,
        mood: data.carousel.style_mood,
      };

      // (2) 편집 카피에 정확 데이터(날짜·금액·연락처·긴 본문)가 있으면 → 이 슬라이드를 overlay로 변환.
      //     모델이 글자를 굽지 않고 컴포지터가 벡터 폰트로 얹어 숫자·날짜가 100% 정확해진다.
      //     bg_url이 생겨 이후 편집은 (1) 재합성 경로로 빠르고 안전하게 처리된다.
      if (anyNeedsOverlay(updated.kicker, updated.headline, updated.body)) {
        const conv = await convertFullSlideToOverlay({
          carouselId,
          concept,
          contentMode: data.carousel.content_mode,
          toneOverride: data.carousel.tone_override,
          styleKnobs,
          designRef,
          referenceImageUrl: data.carousel.reference_url,
          brandId: data.carousel.brand_id,
          total: data.slides.length,
          slide: { ...slideCopy, visual },
        });
        const finalRow = await updateSlideImage(slide.id, {
          image_url: conv.image_url,
          image_path: conv.image_path,
          bg_url: conv.bg_url,
        });
        return ok({ slide: finalRow, converted: true });
      }

      // (3) 정확 데이터 없음 → 디자인 보존 editImage(이전 슬라이드 base) / 실패 시 통째 재생성 폴백.
      let result = slide.image_url
        ? await editFullSlideCopy({
            carouselId,
            sourceImageUrl: slide.image_url,
            prev: { kicker: slide.kicker, headline: slide.headline, body: slide.body },
            next: { kicker: updated.kicker, headline: updated.headline, body: updated.body },
            designRef,
            concept,
            brandId: data.carousel.brand_id,
            total: data.slides.length,
            slideIndex: updated.idx,
          }).catch(() => null)
        : null;
      if (!result) {
        result = await regenerateFullSlide({
          carouselId,
          concept,
          contentMode: data.carousel.content_mode,
          toneOverride: data.carousel.tone_override,
          styleKnobs,
          designRef,
          referenceImageUrl: data.carousel.reference_url,
          brandId: data.carousel.brand_id,
          total: data.slides.length,
          slide: { ...slideCopy, visual },
        });
      }
      const finalRow = await updateSlideImage(slide.id, result);
      return ok({ slide: finalRow });
    }

    // overlay 카루셀인데 보존 배경이 없음(예외) → 카피만 저장(재합성 불가).
    return ok({ slide: updated });
  } catch (e) {
    return serverError(e);
  }
}
