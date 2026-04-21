import { z } from "zod";
import { getBrand, getIdentity, listReferences } from "@/lib/memory";
import { collectSignalsForPrefill, prefillFontPairs } from "@/lib/fonts/prefill";
import { getPresetById } from "@/lib/fonts/tone-pairs";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const BodySchema = z.object({
  force: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const body = await parseJson(request, BodySchema);

    const [brand, identity, references] = await Promise.all([
      getBrand(brandId),
      getIdentity(brandId),
      listReferences(brandId),
    ]);
    if (!brand) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    const result = await prefillFontPairs(
      brandId,
      collectSignalsForPrefill({
        category: brand.category,
        identity,
        references,
      }),
      { force: body.force ?? false },
    );

    const presetLabel = result.presetId
      ? (getPresetById(result.presetId)?.label ?? result.presetId)
      : null;

    return ok({ result, presetLabel });
  } catch (e) {
    return serverError(e);
  }
}
