import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCampaign,
  createRun,
  createVariants,
  getCampaign,
  getLatestRun,
  getSelectedVariant,
  updateRunStatus,
  upsertStage,
  setStageStatus,
} from "@/lib/campaigns";
import { ACTIVE_CHANNELS, isActive } from "@/lib/channels";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const Schema = z.object({
  targetChannel: z.string().min(1),
  nameSuffix: z.string().max(50).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const { targetChannel, nameSuffix } = await parseJson(request, Schema);

    if (!isActive(targetChannel)) {
      throw new ApiError(400, `지원되지 않는 채널: ${targetChannel}`);
    }

    const srcCampaign = await getCampaign(campaignId);
    if (!srcCampaign) throw new ApiError(404, "원본 캠페인을 찾을 수 없습니다");

    if (srcCampaign.channel === targetChannel) {
      throw new ApiError(400, "같은 채널로는 복제할 수 없습니다");
    }

    const srcRun = await getLatestRun(campaignId);
    if (!srcRun) throw new ApiError(400, "원본 실행이 없습니다");

    const [srcStrategy, srcCopy] = await Promise.all([
      getSelectedVariant(srcRun.id, "strategy"),
      getSelectedVariant(srcRun.id, "copy"),
    ]);
    if (!srcStrategy || !srcCopy) {
      throw new ApiError(400, "원본 캠페인에 선택된 Strategy·Copy가 필요합니다");
    }

    const suffix = nameSuffix?.trim() || `(${targetChannel})`;
    const newName = `${srcCampaign.name} ${suffix}`.slice(0, 100);

    const newCampaign = await createCampaign(srcCampaign.brand_id, {
      name: newName,
      goal: srcCampaign.goal,
      offer_id: srcCampaign.offer_id,
      audience_id: srcCampaign.audience_id,
      channel: targetChannel,
      constraints: {
        ...(srcCampaign.constraints_json as Record<string, unknown>),
        forkedFrom: campaignId,
        forkedFromRun: srcRun.id,
      },
    });

    const newRun = await createRun(newCampaign.id);

    const strategyStage = await upsertStage(newRun.id, "strategy", {
      forkedFrom: srcStrategy.id,
    });
    const [newStrategy] = await createVariants(
      strategyStage.id,
      [
        {
          label: srcStrategy.label,
          content: srcStrategy.content_json,
          scores: srcStrategy.scores_json,
          promptVersion: srcStrategy.prompt_version ?? undefined,
        },
      ],
      { mode: "replace", instruction: "fork-channel: cloned" },
    );
    const supabase = createAdminClient();
    await supabase
      .from("creative_variants")
      .update({ selected: true })
      .eq("id", newStrategy.id);
    await setStageStatus(strategyStage.id, "ready");

    const copyStage = await upsertStage(newRun.id, "copy", {
      forkedFrom: srcCopy.id,
    });
    const [newCopy] = await createVariants(
      copyStage.id,
      [
        {
          label: srcCopy.label,
          content: srcCopy.content_json,
          scores: srcCopy.scores_json,
          promptVersion: srcCopy.prompt_version ?? undefined,
        },
      ],
      { mode: "replace", instruction: "fork-channel: cloned" },
    );
    await supabase
      .from("creative_variants")
      .update({ selected: true })
      .eq("id", newCopy.id);
    await setStageStatus(copyStage.id, "ready");

    await updateRunStatus(newRun.id, "visual", "visual");

    return ok({
      campaign: newCampaign,
      run: newRun,
      forkedFrom: { campaignId, runId: srcRun.id },
      activeChannels: ACTIVE_CHANNELS,
    });
  } catch (e) {
    return serverError(e);
  }
}
