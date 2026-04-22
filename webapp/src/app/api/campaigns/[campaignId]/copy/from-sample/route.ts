// Strategy 단계에서 생성된 sampleCopy를 별도 Copy Claude 호출 없이
// copy stage의 variant로 채택한다. "이 전략으로 바로 진행" 버튼에 해당.
// Claude 호출을 skip하여 캠페인당 ~$0.17 절감.

import {
  autoSelectBest,
  createVariants,
  getCampaign,
  getLatestRun,
  getSelectedVariant,
  markDownstreamStale,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import type { CopyVariant } from "@/lib/prompts/copy";
import { COPY_PROMPT_VERSION } from "@/lib/prompts/copy";
import type {
  StrategyAlternative,
  StrategySampleCopy,
} from "@/lib/prompts/strategy";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다. Strategy부터 시작하세요.");

    const selectedStrategy = await getSelectedVariant(run.id, "strategy");
    if (!selectedStrategy) throw new ApiError(400, "선택된 Strategy가 없습니다");

    const strategyContent = selectedStrategy.content_json as unknown as StrategyAlternative;
    const sample: StrategySampleCopy | undefined = strategyContent.sampleCopy;
    if (!sample) {
      throw new ApiError(
        400,
        "선택된 Strategy에 sampleCopy가 없습니다. Copy 전체 생성(POST /copy)을 사용하세요.",
      );
    }

    const stage = await upsertStage(run.id, "copy", {
      strategy_variant_id: selectedStrategy.id,
    });

    const variant: CopyVariant = {
      id: "copy_from_sample",
      headline: sample.headline,
      subCopy: sample.subCopy,
      cta: sample.cta,
      rationale: "Strategy 단계의 sampleCopy 채택 (Copy 생성 skip)",
    };

    const variants = await createVariants(
      stage.id,
      [
        {
          label: variant.id,
          content: variant as unknown as Record<string, unknown>,
          scores: {
            // self-critique 없이 샘플이므로 중간값으로 placeholder.
            taboosClear: 5,
            frameworkFit: 4,
            hookStrength: 4,
            koreanNatural: 4,
            overall: 4.25,
            source: "strategy_sample",
          },
          promptVersion: COPY_PROMPT_VERSION,
        },
      ],
      { mode: "replace", instruction: null, baseVariantId: null },
    );

    await setStageStatus(stage.id, "ready");
    await updateRunStatus(run.id, "copy", "copy");
    await markDownstreamStale(run.id, "copy");

    // from-sample은 variant가 1개뿐이라 자동 선택.
    let autoSelected = null;
    if (campaign.automation_level !== "manual") {
      autoSelected = await autoSelectBest(stage.id, variants);
    }
    const respVariants = autoSelected
      ? variants.map((v) =>
          v.id === autoSelected.id ? { ...v, selected: true } : v,
        )
      : variants;

    return ok({
      run,
      stage,
      variants: respVariants,
      autoSelected: autoSelected?.id ?? null,
      source: "strategy_sample",
    });
  } catch (e) {
    return serverError(e);
  }
}
