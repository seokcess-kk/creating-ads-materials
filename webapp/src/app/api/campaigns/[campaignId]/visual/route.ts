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
import { generateImage, type AspectRatio } from "@/lib/engines/gemini-image";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { getPlaybook } from "@/lib/playbook";
import { getChannel } from "@/lib/channels";
import {
  VISUAL_PROMPT_VERSION,
  VISUAL_VARIANT_SPECS,
  buildGeminiPrompt,
  type VisualPromptContext,
} from "@/lib/prompts/visual";
import { validateVisualImage } from "@/lib/validators/visual-hook";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import type { CopyVariant } from "@/lib/prompts/copy";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const Body = z
  .object({ instruction: z.string().max(500).optional() })
  .optional();

export const maxDuration = 240;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "visual");
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

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    const [selectedStrategy, selectedCopy] = await Promise.all([
      getSelectedVariant(run.id, "strategy"),
      getSelectedVariant(run.id, "copy"),
    ]);
    if (!selectedStrategy) throw new ApiError(400, "선택된 Strategy가 없습니다");
    if (!selectedCopy) throw new ApiError(400, "선택된 Copy가 없습니다");

    const memory = await loadBrandMemory(campaign.brand_id);
    if (!memory) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    const stage = await upsertStage(run.id, "visual", {
      strategy_variant_id: selectedStrategy.id,
      copy_variant_id: selectedCopy.id,
    });

    try {
      const playbook = getPlaybook(campaign.channel, campaign.goal);
      const channel = getChannel(campaign.channel);
      if (!channel) throw new Error(`알 수 없는 채널: ${campaign.channel}`);
      const promptCtx: VisualPromptContext = {
        memory,
        strategy: selectedStrategy.content_json as unknown as StrategyAlternative,
        selectedCopy: selectedCopy.content_json as unknown as CopyVariant,
        playbook,
        channel,
        regenInstruction: body.instruction,
      };

      const existingVariants = await listVariants(stage.id);
      const batchIndex = Math.floor(existingVariants.length / 3) + 1;

      const results = await Promise.allSettled(
        VISUAL_VARIANT_SPECS.map(async (spec) => {
          const prompt = buildGeminiPrompt(promptCtx, spec);
          const image = await generateImage({
            prompt,
            aspectRatio: channel.aspectRatio as AspectRatio,
            imageSize: "2K",
          });
          const { url, path } = await uploadGeneratedImage(
            campaignId,
            `${spec.id}_b${batchIndex}`,
            image,
          );

          let validator: Record<string, unknown> = {};
          try {
            validator = (await validateVisualImage(url, promptCtx, spec)) as unknown as Record<
              string,
              unknown
            >;
          } catch (vErr) {
            validator = { validatorError: (vErr as Error).message };
          }

          return {
            label: `${spec.id}_b${batchIndex}`,
            content: {
              url,
              path,
              focus: spec.focus,
              focusLabel: spec.label,
              prompt,
              batchIndex,
              regenInstruction: body.instruction ?? null,
            } as Record<string, unknown>,
            scores: validator,
            promptVersion: VISUAL_PROMPT_VERSION,
          };
        }),
      );

      const succeeded: Array<{
        label: string;
        content: Record<string, unknown>;
        scores: Record<string, unknown>;
        promptVersion: string;
      }> = [];
      const failures: Array<{ label: string; reason: string }> = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const spec = VISUAL_VARIANT_SPECS[i];
        if (r.status === "fulfilled") succeeded.push(r.value);
        else failures.push({ label: spec.id, reason: (r.reason as Error)?.message ?? "unknown" });
      }

      if (succeeded.length === 0) {
        const msg = failures.map((f) => `${f.label}: ${f.reason}`).join(" / ");
        throw new Error(`모든 변형 실패 — ${msg}`);
      }

      const variants = await createVariants(stage.id, succeeded);
      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "visual", "visual");

      return ok({ run, stage, variants, failures });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Visual 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
