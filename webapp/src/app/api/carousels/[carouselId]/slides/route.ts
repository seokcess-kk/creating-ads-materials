import { ApiError, ok, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import {
  generateSlideDetails,
  renderCarouselSlides,
} from "@/lib/carousel/generate";
import {
  getCarousel,
  replaceSlides,
  setCarouselBg,
  setCarouselStatus,
} from "@/lib/carousel/queries";
import { BundleConceptSchema } from "@/lib/carousel/prompts";
import { DesignReferenceSchema } from "@/lib/generate/analyze-reference";

export const maxDuration = 240;

/** 확정된 기획 → 슬라이드 상세 생성 → 배경 + 합성 → 저장. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  try {
    const { carouselId } = await params;
    const data = await getCarousel(carouselId);
    if (!data) throw new ApiError(404, "캐러셀을 찾을 수 없습니다");

    const conceptParsed = BundleConceptSchema.safeParse(data.carousel.concept_json);
    if (!conceptParsed.success) {
      throw new ApiError(400, "확정된 기획이 없습니다. 먼저 기획을 생성/확정하세요.");
    }
    const concept = conceptParsed.data;

    // 저장된 레퍼런스 디자인 요소(있으면 아트디렉터 styleLock에 주입). 없으면 null.
    const refParsed = DesignReferenceSchema.safeParse(
      data.carousel.reference_json,
    );
    const designRef = refParsed.success ? refParsed.data : null;

    await setCarouselStatus(carouselId, "generating");

    try {
      const brandName = data.carousel.brand_id
        ? (await getBrand(data.carousel.brand_id))?.name ?? null
        : null;

      const details = await generateSlideDetails({
        rawContent: data.carousel.raw_content,
        concept,
        contentMode: data.carousel.content_mode,
        toneOverride: data.carousel.tone_override,
        brandName,
        brandId: data.carousel.brand_id,
        carouselId,
      });

      const { bgUrl, slides } = await renderCarouselSlides({
        carouselId,
        brandId: data.carousel.brand_id,
        concept,
        details,
        bgMode: data.carousel.bg_mode,
        contentMode: data.carousel.content_mode,
        toneOverride: data.carousel.tone_override,
        designRef,
        sharedBgUrl: data.carousel.bg_url, // 재생성 시 shared 배경 재사용
      });

      const rows = await replaceSlides(carouselId, slides);
      await setCarouselBg(carouselId, bgUrl);
      await setCarouselStatus(carouselId, "ready");

      const refreshed = await getCarousel(carouselId);
      return ok(refreshed ?? { carousel: data.carousel, slides: rows });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setCarouselStatus(carouselId, "failed", msg);
      throw new ApiError(500, `슬라이드 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
