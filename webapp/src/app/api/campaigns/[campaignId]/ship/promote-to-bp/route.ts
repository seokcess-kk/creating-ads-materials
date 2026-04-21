import {
  getCampaign,
  getLatestRun,
  getSelectedVariant,
} from "@/lib/campaigns";
import {
  createReference,
  setVisionFailed,
  setVisionResult,
} from "@/lib/memory";
import { analyzeBP } from "@/lib/vision";
import { recomputeLearnings } from "@/lib/learning";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(404, "실행이 없습니다");
    const compose = await getSelectedVariant(run.id, "compose");
    if (!compose) throw new ApiError(400, "선택된 Compose가 없습니다");

    const url = (compose.content_json as { url?: string }).url;
    if (!url) throw new ApiError(400, "Compose URL이 없습니다");

    const ref = await createReference(campaign.brand_id, {
      file_url: url,
      file_name: `${campaign.name}_archive.png`,
      source_type: "own_archive",
      source_note: `캠페인 승격: ${campaign.name} (${campaignId.slice(0, 8)})`,
      is_negative: false,
      weight: 80,
    });

    try {
      const result = await analyzeBP({ source: { type: "url", url } });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
      await recomputeLearnings(campaign.brand_id);
      return ok({
        reference: {
          ...ref,
          vision_analysis_json: result.analysis,
          vision_prompt_version: result.promptVersion,
          vision_status: "ready" as const,
          vision_analyzed_at: new Date().toISOString(),
        },
      });
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : String(vErr);
      await setVisionFailed(ref.id, msg);
      return ok({
        reference: { ...ref, vision_status: "failed" as const, vision_error: msg },
      });
    }
  } catch (e) {
    return serverError(e);
  }
}
