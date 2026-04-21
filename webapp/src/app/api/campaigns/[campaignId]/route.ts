import { z } from "zod";
import { deleteCampaign, getCampaign, getLatestRun, listStages, updateCampaign } from "@/lib/campaigns";
import { ok, fail, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) return fail("캠페인을 찾을 수 없습니다", 404);

    const url = new URL(request.url);
    const withRun = url.searchParams.get("run") === "1";
    if (!withRun) return ok({ campaign });

    const run = await getLatestRun(campaignId);
    const stages = run ? await listStages(run.id) : [];
    return ok({ campaign, run, stages });
  } catch (e) {
    return serverError(e);
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.enum(["TOFU", "MOFU", "BOFU"]).optional(),
  offer_id: z.string().uuid().nullable().optional(),
  audience_id: z.string().uuid().nullable().optional(),
  channel: z.string().min(1).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "running", "completed", "abandoned"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const input = await parseJson(request, PatchSchema);
    const campaign = await updateCampaign(campaignId, input);
    return ok({ campaign });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    await deleteCampaign(campaignId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
