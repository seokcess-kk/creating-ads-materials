import {
  createVariants,
  getCampaign,
  getLatestRun,
  getSelectedVariant,
  getStage,
  listVariants,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { loadBrandMemory } from "@/lib/memory";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { getPlaybook } from "@/lib/playbook";
import { getFunnelGuide } from "@/lib/funnel";
import { getFramework } from "@/lib/frameworks";
import type { FrameworkId } from "@/lib/frameworks/types";
import {
  COPY_PROMPT_VERSION,
  COPY_TOOL_NAME,
  CopyOutputSchema,
  buildCopyMessages,
  buildCopySystem,
  copyTool,
} from "@/lib/prompts/copy";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export const maxDuration = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "copy");
    const variants = stage ? await listVariants(stage.id) : [];
    return ok({ run, stage, variants });
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
    if (!run) throw new ApiError(400, "실행이 없습니다. Strategy부터 시작하세요.");

    const selectedStrategy = await getSelectedVariant(run.id, "strategy");
    if (!selectedStrategy) throw new ApiError(400, "선택된 Strategy가 없습니다");

    const memory = await loadBrandMemory(campaign.brand_id);
    if (!memory) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    const stage = await upsertStage(run.id, "copy", {
      strategy_variant_id: selectedStrategy.id,
    });

    try {
      const strategyContent = selectedStrategy.content_json as unknown as StrategyAlternative;
      const playbook = getPlaybook(campaign.channel, campaign.goal);
      const funnel = getFunnelGuide(campaign.goal);
      const framework = getFramework(strategyContent.frameworkId as FrameworkId);

      const intentNote =
        (campaign.constraints_json as Record<string, string>)?.note ?? null;

      const response = await callClaude({
        model: "opus",
        maxTokens: 5000,
        system: buildCopySystem(),
        messages: buildCopyMessages({
          memory,
          offerId: campaign.offer_id,
          audienceId: campaign.audience_id,
          intentNote,
          strategy: strategyContent,
          playbook,
          framework,
          funnel,
        }),
        tools: [copyTool],
        toolChoice: { type: "tool", name: COPY_TOOL_NAME },
      });

      const raw = extractToolUse(response, COPY_TOOL_NAME);
      if (!raw) throw new Error("카피 결과를 추출할 수 없습니다");

      const parsed = CopyOutputSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`카피 스키마 검증 실패: ${parsed.error.message}`);
      }

      const critiqueMap = new Map(
        parsed.data.critiques.map((c) => [c.variantId, c]),
      );

      const variants = await createVariants(
        stage.id,
        parsed.data.variants.map((v) => {
          const critique = critiqueMap.get(v.id);
          return {
            label: v.id,
            content: v as unknown as Record<string, unknown>,
            scores: critique
              ? {
                  ...critique.scores,
                  issues: critique.issues,
                  suggestions: critique.suggestions,
                }
              : {},
            promptVersion: COPY_PROMPT_VERSION,
          };
        }),
      );

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "copy", "copy");
      return ok({ run, stage, variants });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Copy 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
