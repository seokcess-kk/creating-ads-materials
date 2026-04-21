import { z } from "zod";
import {
  getLatestRun,
  getStage,
  selectVariant,
  updateRunStatus,
} from "@/lib/campaigns";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const SelectSchema = z.object({
  variant_id: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const { variant_id } = await parseJson(request, SelectSchema);

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(404, "실행이 없습니다");
    const stage = await getStage(run.id, "strategy");
    if (!stage) throw new ApiError(404, "Strategy 스테이지가 없습니다");

    const variant = await selectVariant(stage.id, variant_id);
    await updateRunStatus(run.id, "copy", "copy");
    return ok({ variant });
  } catch (e) {
    return serverError(e);
  }
}
