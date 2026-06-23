import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { generateBundleConcept } from "@/lib/carousel/generate";
import {
  createCarousel,
  updateConcept,
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
  title: z.string().max(120).nullable().optional(),
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

    // 2) 번들 기획 생성 → concept 상태로
    try {
      const { concept } = await generateBundleConcept({
        rawContent: input.rawContent,
        contentMode: input.contentMode ?? "persuasion",
        toneOverride: input.toneOverride,
        brandName,
        brandId: input.brandId,
        carouselId: carousel.id,
      });
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
