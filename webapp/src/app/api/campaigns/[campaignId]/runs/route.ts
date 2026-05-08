import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createRun,
  createVariants,
  getCampaign,
  getRunById,
  getSelectedVariant,
  listRuns,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const runs = await listRuns(campaignId, { includeArchived });
    return ok({ runs });
  } catch (e) {
    return serverError(e);
  }
}

const CreateSchema = z.object({
  mode: z.enum(["fresh", "branch-from-copy"]),
  sourceRunId: z.string().uuid().optional(),
  label: z.string().max(80).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const input = await parseJson(request, CreateSchema);

    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    if (input.mode === "fresh") {
      const run = await createRun(campaignId, { label: input.label ?? null });
      return ok({ run });
    }

    // branch-from-copy: 부모 run의 Strategy+Copy를 복사한 후 visual부터 시작
    if (!input.sourceRunId) {
      throw new ApiError(400, "branch-from-copy 모드는 sourceRunId 필요");
    }
    const source = await getRunById(input.sourceRunId);
    if (!source || source.campaign_id !== campaignId) {
      throw new ApiError(404, "원본 소재를 찾을 수 없습니다");
    }

    const [srcStrategy, srcCopy] = await Promise.all([
      getSelectedVariant(source.id, "strategy"),
      getSelectedVariant(source.id, "copy"),
    ]);
    if (!srcStrategy || !srcCopy) {
      throw new ApiError(
        400,
        "원본 소재에 선택된 Strategy·Copy가 모두 있어야 합니다",
      );
    }

    const newRun = await createRun(campaignId, {
      label: input.label ?? null,
      parentRunId: source.id,
    });

    const supabase = await createClient();

    const strategyStage = await upsertStage(newRun.id, "strategy", {
      branchedFrom: srcStrategy.id,
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
      { mode: "replace", instruction: "branch-from-copy: cloned" },
    );
    await supabase
      .from("creative_variants")
      .update({ selected: true })
      .eq("id", newStrategy.id);
    await setStageStatus(strategyStage.id, "ready");

    const copyStage = await upsertStage(newRun.id, "copy", {
      branchedFrom: srcCopy.id,
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
      { mode: "replace", instruction: "branch-from-copy: cloned" },
    );
    await supabase
      .from("creative_variants")
      .update({ selected: true })
      .eq("id", newCopy.id);
    await setStageStatus(copyStage.id, "ready");

    await updateRunStatus(newRun.id, "visual", "visual");

    return ok({
      run: newRun,
      branchedFrom: { runId: source.id, runLabel: source.label },
    });
  } catch (e) {
    return serverError(e);
  }
}
