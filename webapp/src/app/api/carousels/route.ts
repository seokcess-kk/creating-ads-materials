import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { generateBundleConcept } from "@/lib/carousel/generate";
import { analyzeReferenceDesign } from "@/lib/generate/analyze-reference";
import {
  createCarousel,
  updateConcept,
  setCarouselReference,
  setCarouselStatus,
  getCarousel,
  listCarousels,
} from "@/lib/carousel/queries";
import { CAROUSEL_PROMPT_VERSION } from "@/lib/carousel/prompts";
import type { CarouselInput } from "@/lib/carousel/types";

export const maxDuration = 120;

const Schema = z.object({
  brandId: z.string().uuid().nullable().optional(),
  rawContent: z.string().min(10).max(8000),
  toneOverride: z.string().max(300).nullable().optional(),
  contentMode: z.enum(["persuasion", "notice"]).optional(),
  bgMode: z.enum(["shared", "per-slide"]).optional(),
  renderMode: z.enum(["full", "overlay"]).optional(),
  lighting: z.string().max(160).nullable().optional(),
  palette: z.string().max(160).nullable().optional(),
  mood: z.string().max(120).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  referenceImageUrl: z.string().url().max(2000).nullable().optional(),
});

export async function GET() {
  try {
    const carousels = await listCarousels();
    return ok({ carousels });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request: Request) {
  try {
    const input = (await parseJson(request, Schema)) as CarouselInput;

    const brandName = input.brandId
      ? (await getBrand(input.brandId))?.name ?? null
      : null;

    // 1) draft 행 생성
    const carousel = await createCarousel(input, {
      status: "draft",
      promptVersion: CAROUSEL_PROMPT_VERSION,
    });

    // 2) 번들 기획 생성(Opus) + 레퍼런스 분석(Sonnet vision)을 병렬로.
    //    레퍼런스는 콘셉트에 영향 없으므로 독립 — 분석 실패해도 캐러셀 생성은 진행.
    try {
      const [{ concept }, designRef] = await Promise.all([
        generateBundleConcept({
          rawContent: input.rawContent,
          contentMode: input.contentMode ?? "persuasion",
          toneOverride: input.toneOverride,
          brandName,
          brandId: input.brandId,
          carouselId: carousel.id,
        }),
        input.referenceImageUrl
          ? analyzeReferenceDesign(input.referenceImageUrl, {
              operation: "carousel_ref_analyze",
              brandId: input.brandId ?? null,
              metadata: { carouselId: carousel.id },
            })
          : Promise.resolve(null),
      ]);
      // 레퍼런스 먼저 저장 → updateConcept이 반환하는 행에 reference_json 포함되도록.
      if (designRef) await setCarouselReference(carousel.id, designRef);
      const updated = await updateConcept(carousel.id, concept, {
        status: "concept",
      });
      return ok({ carousel: updated });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setCarouselStatus(carousel.id, "failed", msg);
      const data = await getCarousel(carousel.id);
      return ok({ carousel: data?.carousel ?? carousel, error: msg });
    }
  } catch (e) {
    return serverError(e);
  }
}
