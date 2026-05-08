import { z } from "zod";
import {
  archiveRun,
  getRunById,
  unarchiveRun,
  updateRunLabel,
} from "@/lib/campaigns";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ campaignId: string; runId: string }> },
) {
  try {
    const { campaignId, runId } = await params;
    const input = await parseJson(request, PatchSchema);

    const run = await getRunById(runId);
    if (!run || run.campaign_id !== campaignId) {
      throw new ApiError(404, "소재를 찾을 수 없습니다");
    }

    let updated = run;
    if (input.label !== undefined) {
      updated = await updateRunLabel(runId, input.label);
    }
    if (input.archived !== undefined) {
      updated = input.archived
        ? await archiveRun(runId)
        : await unarchiveRun(runId);
    }

    return ok({ run: updated });
  } catch (e) {
    return serverError(e);
  }
}
