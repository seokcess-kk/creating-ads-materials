import {
  createRun,
  createVariants,
  getCampaign,
  getLatestRun,
  listVariants,
  getStage,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { loadBrandMemory } from "@/lib/memory";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { getPlaybook } from "@/lib/playbook";
import { getFunnelGuide } from "@/lib/funnel";
import { getFramework, recommendFrameworksFor } from "@/lib/frameworks";
import {
  STRATEGY_PROMPT_VERSION,
  STRATEGY_TOOL_NAME,
  StrategyOutputSchema,
  type StrategyAlternative,
  buildStrategyMessages,
  buildStrategySystem,
  strategyTool,
} from "@/lib/prompts/strategy";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const Body = z
  .object({ instruction: z.string().max(500).optional() })
  .optional();

export const maxDuration = 90;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "strategy");
    const variants = stage ? await listVariants(stage.id) : [];
    return ok({ run, stage, variants });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    let body: { instruction?: string } = {};
    try {
      body = Body.parse(await request.json()) ?? {};
    } catch {}

    const memory = await loadBrandMemory(campaign.brand_id);
    if (!memory) throw new ApiError(404, "브랜드를 찾을 수 없습니다");
    if (memory.offers.length === 0 || memory.audiences.length === 0 || !memory.identity) {
      throw new ApiError(400, "Memory(Identity·Offer·Audience) 미설정");
    }

    const run = (await getLatestRun(campaignId)) ?? (await createRun(campaignId));
    await updateRunStatus(run.id, "strategy", "strategy");

    const stage = await upsertStage(run.id, "strategy", {
      offer_id: campaign.offer_id,
      audience_id: campaign.audience_id,
      channel: campaign.channel,
    });

    const existingVariants = await listVariants(stage.id);
    const previousAngles = existingVariants.map((v) => {
      const c = v.content_json as unknown as StrategyAlternative;
      return {
        angleName: c.angleName,
        hookType: c.hookType,
        frameworkId: c.frameworkId,
      };
    });

    try {
      const playbook = getPlaybook(campaign.channel, campaign.goal);
      const funnel = getFunnelGuide(campaign.goal);
      const frameworkIds = recommendFrameworksFor(campaign.goal);
      const frameworks = frameworkIds.map(getFramework);

      const intentNote =
        (campaign.constraints_json as Record<string, string>)?.note ?? null;

      const response = await callClaude({
        model: "opus",
        maxTokens: 4000,
        system: buildStrategySystem(),
        messages: buildStrategyMessages({
          memory,
          offerId: campaign.offer_id,
          audienceId: campaign.audience_id,
          intentNote,
          playbook,
          frameworks,
          funnel,
          regenInstruction: body.instruction,
          previousAngles,
        }),
        tools: [strategyTool],
        toolChoice: { type: "tool", name: STRATEGY_TOOL_NAME },
      });

      const raw = extractToolUse(response, STRATEGY_TOOL_NAME);
      if (!raw) throw new Error("전략 결과를 추출할 수 없습니다");

      const parsed = StrategyOutputSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`전략 스키마 검증 실패: ${parsed.error.message}`);
      }

      const batchIndex = existingVariants.length / 3 + 1;
      const variants = await createVariants(
        stage.id,
        parsed.data.alternatives.map((a) => ({
          label: `${a.id}_b${batchIndex}`,
          content: {
            ...(a as unknown as Record<string, unknown>),
            batchIndex,
            regenInstruction: body.instruction ?? null,
          },
          promptVersion: STRATEGY_PROMPT_VERSION,
        })),
      );

      await setStageStatus(stage.id, "ready");
      return ok({ run, stage, variants, playbookVersion: playbook.version });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      await updateRunStatus(run.id, "failed");
      throw new ApiError(500, `Strategy 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
