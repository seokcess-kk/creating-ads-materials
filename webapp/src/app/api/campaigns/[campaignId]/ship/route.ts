import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCampaign,
  getLatestRun,
  getSelectedVariant,
  getStage,
  setStageStatus,
  updateCampaign,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { getBrand } from "@/lib/memory";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null });
    const stage = await getStage(run.id, "ship");
    return ok({ run, stage });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    const [strategy, copy, visual, retouch, compose] = await Promise.all([
      getSelectedVariant(run.id, "strategy"),
      getSelectedVariant(run.id, "copy"),
      getSelectedVariant(run.id, "visual"),
      getSelectedVariant(run.id, "retouch"),
      getSelectedVariant(run.id, "compose"),
    ]);
    if (!compose) throw new ApiError(400, "선택된 Compose가 없습니다");

    const stage = await upsertStage(run.id, "ship", {});

    try {
      const brand = await getBrand(campaign.brand_id);
      const snapshot = {
        completedAt: new Date().toISOString(),
        brand,
        campaign,
        finalUrl: (compose.content_json as { url?: string }).url,
        stages: {
          strategy: strategy
            ? { variantId: strategy.id, content: strategy.content_json, promptVersion: strategy.prompt_version }
            : null,
          copy: copy
            ? {
                variantId: copy.id,
                content: copy.content_json,
                scores: copy.scores_json,
                promptVersion: copy.prompt_version,
              }
            : null,
          visual: visual
            ? {
                variantId: visual.id,
                content: visual.content_json,
                scores: visual.scores_json,
                promptVersion: visual.prompt_version,
              }
            : null,
          retouch: retouch
            ? {
                variantId: retouch.id,
                content: retouch.content_json,
                promptVersion: retouch.prompt_version,
              }
            : null,
          compose: {
            variantId: compose.id,
            content: compose.content_json,
            promptVersion: compose.prompt_version,
          },
        },
      };

      const supabase = createAdminClient();
      const { error } = await supabase
        .from("creative_runs")
        .update({
          brand_memory_snapshot: snapshot,
          status: "complete",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      if (error) throw error;

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "complete");
      await updateCampaign(campaignId, { status: "completed" });

      return ok({ snapshot, campaign: { ...campaign, status: "completed" } });
    } catch (shipErr) {
      const msg = shipErr instanceof Error ? shipErr.message : String(shipErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Ship 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
