import { z } from "zod";
import {
  deleteCampaign,
  getCampaign,
  getLatestRun,
  listStages,
  markDownstreamStale,
  updateCampaign,
} from "@/lib/campaigns";
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
  automation_level: z.enum(["manual", "assist", "auto"]).optional(),
  key_visual_intent: z.string().max(500).nullable().optional(),
  selected_key_visual_ids: z.array(z.string().uuid()).max(10).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const input = await parseJson(request, PatchSchema);

    const before = await getCampaign(campaignId);
    if (!before) return fail("캠페인을 찾을 수 없습니다", 404);

    const campaign = await updateCampaign(campaignId, input);

    // 채널이 바뀌면 종횡비/소재 사이즈가 달라지므로 visual 이후 단계는 stale 처리.
    // selected_key_visual_ids가 바뀌면 Key Visual 트랙(B)이 달라지므로 동일하게 visual부터 stale.
    const channelChanged =
      input.channel !== undefined && input.channel !== before.channel;
    const kvChanged =
      input.selected_key_visual_ids !== undefined &&
      JSON.stringify([...input.selected_key_visual_ids].sort()) !==
        JSON.stringify([...before.selected_key_visual_ids].sort());
    if (channelChanged || kvChanged) {
      const run = await getLatestRun(campaignId);
      if (run) await markDownstreamStale(run.id, "copy");
    }

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
