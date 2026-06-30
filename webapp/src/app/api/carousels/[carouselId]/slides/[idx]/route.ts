import { z } from "zod";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import {
  recomposeSlide,
  regenerateFullSlide,
  editFullSlideCopy,
} from "@/lib/carousel/generate";
import {
  getCarousel,
  updateSlideCopy,
  updateSlideImage,
} from "@/lib/carousel/queries";
import { BundleConceptSchema } from "@/lib/carousel/prompts";
import { DesignReferenceSchema } from "@/lib/generate/analyze-reference";
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

    // full 모드: 가능하면 이전 슬라이드를 base로 글자만 교체(editImage — 디자인 보존).
    // 소스 미확보/편집 실패 시에만 통째 재생성(regenerateFullSlide)으로 폴백.
    if (data.carousel.render_mode === "full") {
      const concept = conceptParsed.success ? conceptParsed.data : null;
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
        const vj = updated.visual_json as Partial<SlideVisual>;
        const visual: SlideVisual | undefined = vj.motif
          ? { motif: vj.motif, emphasis: vj.emphasis ?? "keyword" }
          : undefined;
        result = await regenerateFullSlide({
          carouselId,
          concept,
          contentMode: data.carousel.content_mode,
          toneOverride: data.carousel.tone_override,
          styleKnobs: {
            lighting: data.carousel.style_lighting,
            palette: data.carousel.style_palette,
            mood: data.carousel.style_mood,
          },
          designRef,
          brandId: data.carousel.brand_id,
          total: data.slides.length,
          slide: {
            index: updated.idx,
            role: updated.role,
            kicker: updated.kicker ?? undefined,
            headline: updated.headline,
            body: updated.body ?? undefined,
            visual,
          },
        });
      }
      const finalRow = await updateSlideImage(slide.id, result);
      return ok({ slide: finalRow });
    }

    // overlay 모드: 기존 배경으로 재합성(LLM 호출 없음).
    const bgUrl = updated.bg_url ?? data.carousel.bg_url;
    if (!bgUrl) {
      // 배경이 없으면 카피만 저장(재합성 불가)
      return ok({ slide: updated });
    }
    const templateId = conceptParsed.success
      ? conceptParsed.data.template
      : null;
    const { image_url, image_path } = await recomposeSlide({
      carouselId,
      bgUrl,
      total: data.slides.length,
      templateId,
      designRef,
      slide: {
        index: updated.idx,
        role: updated.role,
        kicker: updated.kicker ?? undefined,
        headline: updated.headline,
        body: updated.body ?? undefined,
      },
    });
    const finalRow = await updateSlideImage(slide.id, { image_url, image_path });
    return ok({ slide: finalRow });
  } catch (e) {
    return serverError(e);
  }
}
