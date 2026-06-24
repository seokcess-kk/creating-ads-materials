import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { generateAdCopy } from "@/lib/generate/copy";

export const maxDuration = 60;

const Schema = z.object({
  keyMessage: z.string().min(4).max(500),
  concept: z.string().max(1000).nullable().optional(),
  tone: z.string().max(300).nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  count: z.number().int().min(3).max(6).optional(),
});

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, Schema);
    const brand = input.brandId ? await getBrand(input.brandId) : null;
    const options = await generateAdCopy(
      {
        concept: input.concept,
        keyMessage: input.keyMessage,
        tone: input.tone,
        brandName: brand?.name ?? null,
        brandCategory: brand?.category ?? null,
        count: input.count,
      },
      { operation: "single_image_copy", brandId: input.brandId ?? null },
    );
    return ok({ options });
  } catch (e) {
    return serverError(e);
  }
}
