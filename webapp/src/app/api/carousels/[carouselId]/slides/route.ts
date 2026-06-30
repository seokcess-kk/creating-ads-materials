import { ApiError, ok, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import {
  generateSlideDetails,
  renderCarouselSlides,
  resolveCarouselRenderMode,
} from "@/lib/carousel/generate";
import {
  getCarousel,
  insertSlideSkeletons,
  setCarouselBg,
  setCarouselRenderMode,
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

      // 텍스트 안전 게이트: 공지·정보형이거나 정확한 수치·날짜·연락처·긴 본문이 있으면
      // full(AI 일체형)을 overlay(후합성)로 강등하고 그 결과를 영속화한다(DB·UI·편집 일관).
      const effectiveRenderMode = resolveCarouselRenderMode(
        data.carousel.render_mode,
        data.carousel.content_mode,
        details,
      );
      if (effectiveRenderMode !== data.carousel.render_mode) {
        await setCarouselRenderMode(carouselId, effectiveRenderMode);
      }

      // 1) 텍스트만 있는 스켈레톤 먼저 기록 → 클라이언트 폴링이 골격을 즉시 본다.
      const rows = await insertSlideSkeletons(carouselId, details);
      const rowIdByIndex = new Map(rows.map((r) => [r.idx, r.id]));

      // 2) 배경 생성 + 합성 — 완성되는 슬라이드부터 행을 점진 갱신.
      const { bgUrl } = await renderCarouselSlides({
        carouselId,
        brandId: data.carousel.brand_id,
        concept,
        details,
        bgMode: data.carousel.bg_mode,
        contentMode: data.carousel.content_mode,
        renderMode: effectiveRenderMode,
        toneOverride: data.carousel.tone_override,
        styleKnobs: {
          lighting: data.carousel.style_lighting,
          palette: data.carousel.style_palette,
          mood: data.carousel.style_mood,
        },
        designRef,
        // 전체 재생성("슬라이드 전체 다시 만들기")은 현재 템플릿·레퍼런스를 반영해야 하므로
        // shared 배경도 새로 생성한다(기존 bg_url 재사용 금지). 카피만 고치는 경로는
        // recomposeSlide가 각 슬라이드의 bg_url을 재사용하므로 영향 없음.
        sharedBgUrl: null,
        rowIdByIndex,
      });

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
