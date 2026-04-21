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
    const stage = await getStage(run.id, "visual");
    if (!stage) throw new ApiError(404, "Visual 스테이지가 없습니다");

    const variant = await selectVariant(stage.id, variant_id);
    // M2 종료: retouch 단계로 넘어갈 수는 있으나 M3에서 활성화
    await updateRunStatus(run.id, "visual", "visual");
    return ok({ variant });
  } catch (e) {
    return serverError(e);
  }
}
