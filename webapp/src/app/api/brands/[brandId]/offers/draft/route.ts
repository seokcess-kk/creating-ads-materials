import { z } from "zod";
import {
  getAudience,
  getBrand,
  getIdentity,
  listAudiences,
  listKeyVisuals,
  listOffers,
} from "@/lib/memory";
import { generateOfferDrafts } from "@/lib/analysis/generate-offers";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

const Schema = z.object({
  intent: z.string().min(4).max(400),
  audienceId: z.string().uuid().nullable().optional(),
  channel: z.string().max(80).nullable().optional(),
  count: z.number().int().min(2).max(6).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, Schema);

    const brand = await getBrand(brandId);
    if (!brand) return serverError(new Error("브랜드를 찾을 수 없습니다"));

    let audience = input.audienceId ? await getAudience(input.audienceId) : null;
    if (!audience) {
      const all = await listAudiences(brandId);
      audience = all.find((a) => a.is_default) ?? all[0] ?? null;
    }
    if (!audience) {
      return serverError(
        new Error("페르소나가 없습니다. 먼저 Audiences에서 페르소나를 등록하세요."),
      );
    }

    const [identity, keyVisuals, existingOffers] = await Promise.all([
      getIdentity(brandId),
      listKeyVisuals(brandId),
      listOffers(brandId),
    ]);

    const batch = await generateOfferDrafts({
      brand,
      identity,
      audience,
      keyVisuals,
      existingOffers,
      intent: input.intent,
      channel: input.channel ?? undefined,
      count: input.count ?? 4,
      usageContext: {
        operation: "offer_draft_generate",
        brandId,
      },
    });

    return ok({
      drafts: batch.drafts,
      audience: { id: audience.id, persona_name: audience.persona_name },
    });
  } catch (e) {
    return serverError(e);
  }
}
