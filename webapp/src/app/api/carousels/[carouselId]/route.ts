import { z } from "zod";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { generateBundleConcept } from "@/lib/carousel/generate";
import {
  getCarousel,
  updateConcept,
  deleteCarousel,
  setCarouselStatus,
} from "@/lib/carousel/queries";
import { createClient } from "@/lib/supabase/server";
import { BundleConceptSchema } from "@/lib/carousel/prompts";

export const maxDuration = 120;

const PatchSchema = z.object({
  regenerate: z.boolean().optional(),
  concept: BundleConceptSchema.optional(),
  bgMode: z.enum(["shared", "per-slide"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  try {
    const { carouselId } = await params;
    const data = await getCarousel(carouselId);
    if (!data) throw new ApiError(404, "캐러셀을 찾을 수 없습니다");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  try {
    const { carouselId } = await params;
    const body = await parseJson(request, PatchSchema);
    const data = await getCarousel(carouselId);
    if (!data) throw new ApiError(404, "캐러셀을 찾을 수 없습니다");

    // bg_mode만 변경
    if (body.bgMode) {
      const supabase = await createClient();
      const { error } = await supabase
        .from("carousels")
        .update({ bg_mode: body.bgMode })
        .eq("id", carouselId);
      if (error) throw error;
    }

    // 기획 AI 재생성
    if (body.regenerate) {
      try {
        const brandName = data.carousel.brand_id
          ? (await getBrand(data.carousel.brand_id))?.name ?? null
          : null;
        const { concept } = await generateBundleConcept({
          rawContent: data.carousel.raw_content,
          contentMode: data.carousel.content_mode,
          toneOverride: data.carousel.tone_override,
          brandName,
          brandId: data.carousel.brand_id,
          carouselId,
        });
        const updated = await updateConcept(carouselId, concept, {
          status: "concept",
        });
        return ok({ carousel: updated });
      } catch (genErr) {
        const msg = genErr instanceof Error ? genErr.message : String(genErr);
        await setCarouselStatus(carouselId, "failed", msg);
        throw new ApiError(500, `기획 재생성 실패: ${msg}`);
      }
    }

    // 사용자 편집 콘셉트 저장
    if (body.concept) {
      const updated = await updateConcept(carouselId, body.concept, {
        status: "concept",
      });
      return ok({ carousel: updated });
    }

    const refreshed = await getCarousel(carouselId);
    return ok(refreshed ?? data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  try {
    const { carouselId } = await params;
    await deleteCarousel(carouselId);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
