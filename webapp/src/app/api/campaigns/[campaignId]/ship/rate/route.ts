import { z } from "zod";
import { getCampaign, getLatestRun, rateRun } from "@/lib/campaigns";
import { recomputeLearnings } from "@/lib/learning";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const Schema = z.object({
  rating: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(500).nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const input = await parseJson(request, Schema);

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(404, "실행이 없습니다");

    const updated = await rateRun(run.id, input.rating, input.note);

    const campaign = await getCampaign(campaignId);
    if (campaign) {
      try {
        await recomputeLearnings(campaign.brand_id);
      } catch (e) {
        console.warn("Learnings 재계산 실패:", (e as Error).message);
      }
    }

    return ok({ run: updated });
  } catch (e) {
    return serverError(e);
  }
}
