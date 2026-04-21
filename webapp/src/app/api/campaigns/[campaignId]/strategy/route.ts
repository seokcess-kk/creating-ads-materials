import {
  autoSelectBest,
  createRun,
  createVariants,
  getCampaign,
  getLatestRun,
  listVariants,
  getStage,
  markDownstreamStale,
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
  .object({
    instruction: z.string().max(500).optional(),
    mode: z.enum(["replace", "add", "remix"]).optional(),
    baseVariantId: z.string().uuid().optional(),
  })
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

    let body: {
      instruction?: string;
      mode?: "replace" | "add" | "remix";
      baseVariantId?: string;
    } = {};
    try {
      body = Body.parse(await request.json()) ?? {};
    } catch {}
    const mode = body.mode ?? "replace";
    if (mode === "remix" && !body.baseVariantId) {
      throw new ApiError(400, "remix 모드는 baseVariantId 필요");
    }

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

    const existingActive = await listVariants(stage.id);
    // add 모드에서만 이전 각도를 "회피 대상"으로 전달
    const previousAngles =
      mode === "add"
        ? existingActive.map((v) => {
            const c = v.content_json as unknown as StrategyAlternative;
            return {
              angleName: c.angleName,
              hookType: c.hookType,
              frameworkId: c.frameworkId,
            };
          })
        : [];

    try {
      const playbook = getPlaybook(campaign.channel, campaign.goal);
      const funnel = getFunnelGuide(campaign.goal);
      const frameworkIds = recommendFrameworksFor(campaign.goal);
      const frameworks = frameworkIds.map(getFramework);

      const intentNote =
        (campaign.constraints_json as Record<string, string>)?.note ?? null;

      const response = await callClaude({
        model: "opus",
        maxTokens: 6000,
        system: buildStrategySystem(),
        usageContext: {
          operation: "strategy",
          brandId: campaign.brand_id,
          campaignId,
        },
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

      if (response.stop_reason === "max_tokens") {
        throw new Error(
          "Claude 응답이 토큰 한도에서 잘렸습니다. maxTokens를 더 늘리거나 요청을 줄여주세요.",
        );
      }

      const raw = extractToolUse(response, STRATEGY_TOOL_NAME);
      if (!raw) throw new Error("전략 결과를 추출할 수 없습니다");

      const parsed = StrategyOutputSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `전략 스키마 검증 실패 (stop=${response.stop_reason}): ${parsed.error.message}`,
        );
      }

      const variants = await createVariants(
        stage.id,
        parsed.data.alternatives.map((a) => ({
          label: a.id,
          content: a as unknown as Record<string, unknown>,
          promptVersion: STRATEGY_PROMPT_VERSION,
        })),
        {
          mode,
          instruction: body.instruction ?? null,
          baseVariantId: body.baseVariantId ?? null,
        },
      );

      await setStageStatus(stage.id, "ready");
      // Replace 모드: 이전 선택이 archived됨 → downstream 유효성 깨짐
      if (mode === "replace") {
        await markDownstreamStale(run.id, "strategy");
      }

      // Auto-pilot: Assist/Auto 모드면 최고점 자동 선택
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
        playbookVersion: playbook.version,
        autoSelected: autoSelected?.id ?? null,
      });
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
