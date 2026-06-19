import {
  getCampaign,
  getSelectedVariant,
  resolveRun,
} from "@/lib/campaigns";
import {
  createReference,
  setVisionFailed,
  setVisionResult,
} from "@/lib/memory";
import { analyzeBP, embedAndStoreBP } from "@/lib/vision";
import { recomputeLearnings } from "@/lib/learning";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

// BP 가중치를 소재 평점에 맞춘다. 평점 무관 하드코딩(80)이면 별 1점 소재도
// "모범 사례"로 등록돼 rate 경로(±8 미세조정)와 상충한다.
function weightFromRating(rating: number | null | undefined): number {
  if (rating == null) return 60; // 미평가: 중립보다 약간 높게
  // 1→40, 2→50, 3→65, 4→80, 5→95
  return [40, 40, 50, 65, 80, 95][rating] ?? 60;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const runIdHint = new URL(request.url).searchParams.get("runId");
    const run = await resolveRun(campaignId, runIdHint);
    if (!run) throw new ApiError(404, "실행이 없습니다");
    const compose = await getSelectedVariant(run.id, "compose");
    if (!compose) throw new ApiError(400, "선택된 Compose가 없습니다");

    const url = (compose.content_json as { url?: string }).url;
    if (!url) throw new ApiError(400, "Compose URL이 없습니다");

    const ref = await createReference(campaign.brand_id, {
      file_url: url,
      // 승격본을 References에서 캠페인으로 역추적할 수 있도록 source_url 채움
      source_url: `/campaigns/${campaignId}?run=${run.id}`,
      file_name: `${campaign.name}_archive.png`,
      source_type: "own_archive",
      source_note: `캠페인 승격: ${campaign.name} (${campaignId.slice(0, 8)})`,
      is_negative: false,
      weight: weightFromRating(run.rating),
    });

    try {
      const result = await analyzeBP({
        source: { type: "url", url },
        usageContext: {
          operation: "vision_bp_promote",
          brandId: campaign.brand_id,
          campaignId,
        },
      });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
      try {
        await embedAndStoreBP({
          referenceId: ref.id,
          analysis: result.analysis,
          sourceType: ref.source_type,
          note: ref.source_note,
          usageContext: {
            operation: "bp_embed_promote",
            brandId: campaign.brand_id,
            campaignId,
          },
        });
      } catch (eErr) {
        console.warn("BP embedding 생성 실패:", (eErr as Error).message);
      }
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
