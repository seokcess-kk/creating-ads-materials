import {
  autoSelectBest,
  createVariants,
  getCampaign,
  getSelectedVariant,
  getStage,
  listVariants,
  markDownstreamStale,
  markStagesStale,
  resolveRun,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { loadBrandMemory } from "@/lib/memory";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import {
  briefToText,
  formatRelevantBPsDigest,
  retrieveRelevantBPs,
} from "@/lib/vision/retrieve";
import { getPlaybook } from "@/lib/playbook";
import { resolveFunnelGuide } from "@/lib/funnel";
import { getFramework } from "@/lib/frameworks";
import type { FrameworkId } from "@/lib/frameworks/types";
import {
  COPY_PROMPT_VERSION,
  COPY_TOOL_NAME,
  CopyOutputSchema,
  type CopyVariant,
  buildCopyMessages,
  buildCopySystem,
  copyTool,
} from "@/lib/prompts/copy";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const Body = z
  .object({
    instruction: z.string().max(500).optional(),
    mode: z.enum(["replace", "add", "remix"]).optional(),
    baseVariantId: z.string().uuid().optional(),
  })
  .optional();

export const maxDuration = 120;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const runIdHint = new URL(request.url).searchParams.get("runId");
    const run = await resolveRun(campaignId, runIdHint);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "copy");
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

    const runIdHint = new URL(request.url).searchParams.get("runId");
    const run = await resolveRun(campaignId, runIdHint);
    if (!run) throw new ApiError(400, "실행이 없습니다. Strategy부터 시작하세요.");

    const selectedStrategy = await getSelectedVariant(run.id, "strategy");
    if (!selectedStrategy) throw new ApiError(400, "선택된 Strategy가 없습니다");

    const memory = await loadBrandMemory(campaign.brand_id);
    if (!memory) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    const stage = await upsertStage(run.id, "copy", {
      strategy_variant_id: selectedStrategy.id,
    });

    const existingActive = await listVariants(stage.id);
    const previousHeadlines =
      mode === "add"
        ? existingActive
            .map((v) => (v.content_json as unknown as CopyVariant).headline)
            .filter((h): h is string => Boolean(h))
        : [];

    try {
      const isNotice = campaign.content_mode === "notice";
      const strategyContent = selectedStrategy.content_json as unknown as StrategyAlternative;
      const playbook = getPlaybook(campaign.channel, campaign.goal);
      const funnel = resolveFunnelGuide(campaign.goal, campaign.content_mode);
      const framework = getFramework(strategyContent.frameworkId as FrameworkId);

      const intentNote =
        (campaign.constraints_json as Record<string, string>)?.note ?? null;

      // notice 모드는 offer 중심 BP 검색을 생략(offers[0] silent fallback 회피).
      let semanticBPDigest: string | null = null;
      if (!isNotice) {
        try {
          const offer =
            memory.offers.find((o) => o.id === campaign.offer_id) ?? memory.offers[0] ?? null;
          const audience =
            memory.audiences.find((a) => a.id === campaign.audience_id) ?? memory.audiences[0] ?? null;
          const queryText = briefToText({
            brandName: memory.brand.name,
            brandCategory: memory.brand.category,
            offer,
            audience,
            intentNote,
            strategy: strategyContent,
            channel: campaign.channel,
            goal: campaign.goal,
          });
          const matches = await retrieveRelevantBPs(campaign.brand_id, queryText, {
            limit: 5,
            minSimilarity: 0.3,
            usageContext: {
              operation: "bp_retrieve_copy",
              brandId: campaign.brand_id,
              campaignId,
              runId: run.id,
            },
          });
          semanticBPDigest = formatRelevantBPsDigest(matches);
        } catch (retErr) {
          console.warn("Semantic BP 검색 실패:", (retErr as Error).message);
        }
      }

      const response = await callClaude({
        model: "opus",
        maxTokens: 8000,
        system: buildCopySystem(isNotice),
        usageContext: {
          operation: "copy",
          brandId: campaign.brand_id,
          campaignId,
          runId: run.id,
        },
        messages: buildCopyMessages({
          memory,
          offerId: campaign.offer_id,
          audienceId: campaign.audience_id,
          intentNote,
          strategy: strategyContent,
          playbook,
          framework,
          funnel,
          channel: campaign.channel,
          semanticBPDigest,
          keyVisualIntent: campaign.key_visual_intent,
          selectedKeyVisualIds: campaign.selected_key_visual_ids,
          regenInstruction: body.instruction,
          previousHeadlines,
          isNotice,
          rawContent: campaign.raw_content,
          noticeMeta: campaign.notice_meta,
          toneOverride: campaign.tone_override,
        }),
        tools: [copyTool],
        toolChoice: { type: "tool", name: COPY_TOOL_NAME },
      });

      if (response.stop_reason === "max_tokens") {
        throw new Error(
          "Claude 응답이 토큰 한도에서 잘렸습니다. maxTokens를 더 늘리거나 요청을 줄여주세요.",
        );
      }

      const raw = extractToolUse(response, COPY_TOOL_NAME);
      if (!raw) throw new Error("카피 결과를 추출할 수 없습니다");

      const parsed = CopyOutputSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `카피 스키마 검증 실패 (stop=${response.stop_reason}): ${parsed.error.message}`,
        );
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
        {
          mode,
          instruction: body.instruction ?? null,
          baseVariantId: body.baseVariantId ?? null,
        },
      );

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "copy", "copy");
      if (mode === "replace") {
        // notice 모드: 배경(visual)은 카피와 무관(textless)하므로 보존하고,
        // 텍스트가 얹히는 compose/ship만 stale 처리 → "배경 유지, 텍스트만 갱신" 루프 성립.
        // persuasion 모드: 기존대로 카피→이미지 텍스트 종속이라 visual부터 하위 전체 stale.
        if (isNotice) {
          await markStagesStale(run.id, ["compose", "ship"]);
        } else {
          await markDownstreamStale(run.id, "copy");
        }
      }

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
      });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Copy 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
