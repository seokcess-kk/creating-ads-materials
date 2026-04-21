import {
  autoSelectBest,
  createVariants,
  getCampaign,
  getLatestRun,
  getSelectedVariant,
  getStage,
  listVariants,
  markDownstreamStale,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { loadBrandMemory } from "@/lib/memory";
import { listKeyVisualsByIds } from "@/lib/memory/key-visuals";
import {
  generateImage,
  editImage,
  type AspectRatio,
} from "@/lib/engines/gemini-image";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { composePersonVariant } from "@/lib/canvas/compose-person-variant";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import { getPlaybook } from "@/lib/playbook";
import { getChannel } from "@/lib/channels";
import {
  VISUAL_PROMPT_VERSION,
  VISUAL_ASSET_PROMPT_VERSION,
  VISUAL_VARIANT_SPECS,
  buildGeminiPrompt,
  buildEditImagePrompt,
  type VisualPromptContext,
  type VisualVariantSpec,
} from "@/lib/prompts/visual";
import type { BrandKeyVisual } from "@/lib/memory/types";
import { validateVisualImage } from "@/lib/validators/visual-hook";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import type { CopyVariant } from "@/lib/prompts/copy";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const Body = z
  .object({
    instruction: z.string().max(500).optional(),
    mode: z.enum(["replace", "add", "remix"]).optional(),
    baseVariantId: z.string().uuid().optional(),
  })
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
        goal: campaign.goal,
        regenInstruction: body.instruction,
      };

      // Key Visual 에셋 기반 생성 분기.
      // kind별 트랙 선택:
      //   person  → Track A (Compositor): 픽셀 보존, 얼굴 변형 없음
      //   space/product → Track B (Gemini editImage): 원본 구도 유지 + 타이포 추가
      //   (에셋 없음) → 기존 generateImage
      const selectedKvIds = campaign.selected_key_visual_ids ?? [];
      const keyVisualPool: BrandKeyVisual[] = selectedKvIds.length
        ? await listKeyVisualsByIds(selectedKvIds)
        : [];

      const pickAsset = (i: number): BrandKeyVisual | null => {
        if (keyVisualPool.length === 0) return null;
        return keyVisualPool[i % keyVisualPool.length];
      };

      type Track = "gemini_gen" | "gemini_edit" | "compositor";

      const results = await Promise.allSettled(
        VISUAL_VARIANT_SPECS.map(async (spec: VisualVariantSpec, i: number) => {
          const asset = pickAsset(i);
          let prompt: string | null = null;
          let track: Track = "gemini_gen";
          let promptVersion = VISUAL_PROMPT_VERSION;
          let url: string;
          let path: string;
          let layoutMeta: Record<string, unknown> | null = null;

          if (asset && asset.kind === "person") {
            // Track A: Compositor (실사 100% 보존)
            track = "compositor";
            promptVersion = VISUAL_ASSET_PROMPT_VERSION;
            const copyContent = selectedCopy.content_json as unknown as CopyVariant;
            const result = await composePersonVariant({
              campaignId,
              spec,
              keyVisual: asset,
              copy: copyContent,
            });
            url = result.url;
            path = result.path;
            layoutMeta = result.layout as unknown as Record<string, unknown>;
          } else if (asset) {
            // Track B: Gemini editImage (space/product)
            track = "gemini_edit";
            promptVersion = VISUAL_ASSET_PROMPT_VERSION;
            prompt = buildEditImagePrompt(
              { ...promptCtx, keyVisual: asset },
              spec,
            );
            const baseImage = await fetchAsBase64(asset.storage_url);
            const image = await editImage({
              prompt,
              baseImage,
              aspectRatio: channel.aspectRatio as AspectRatio,
              imageSize: "2K",
              usageContext: {
                operation: "visual_gen_asset",
                brandId: campaign.brand_id,
                campaignId,
                metadata: {
                  focus: spec.focus,
                  keyVisualId: asset.id,
                  keyVisualKind: asset.kind,
                },
              },
            });
            const uniq = Date.now().toString(36);
            const uploaded = await uploadGeneratedImage(
              campaignId,
              `${spec.id}_${uniq}`,
              image,
            );
            url = uploaded.url;
            path = uploaded.path;
          } else {
            // 에셋 없음 — 기존 generateImage 경로
            prompt = buildGeminiPrompt(promptCtx, spec);
            const image = await generateImage({
              prompt,
              aspectRatio: channel.aspectRatio as AspectRatio,
              imageSize: "2K",
              usageContext: {
                operation: "visual_gen",
                brandId: campaign.brand_id,
                campaignId,
                metadata: { focus: spec.focus },
              },
            });
            const uniq = Date.now().toString(36);
            const uploaded = await uploadGeneratedImage(
              campaignId,
              `${spec.id}_${uniq}`,
              image,
            );
            url = uploaded.url;
            path = uploaded.path;
          }

          let validator: Record<string, unknown> = {};
          try {
            validator = (await validateVisualImage(url, promptCtx, spec, {
              operation: "visual_validator",
              brandId: campaign.brand_id,
              campaignId,
              metadata: { focus: spec.focus, track },
            })) as unknown as Record<string, unknown>;
          } catch (vErr) {
            validator = { validatorError: (vErr as Error).message };
          }

          return {
            label: spec.id,
            content: {
              url,
              path,
              focus: spec.focus,
              focusLabel: spec.label,
              prompt,
              track,
              keyVisualId: asset?.id ?? null,
              keyVisualLabel: asset?.label ?? null,
              keyVisualKind: asset?.kind ?? null,
              layout: layoutMeta,
            } as Record<string, unknown>,
            scores: validator,
            promptVersion,
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

      const variants = await createVariants(stage.id, succeeded, {
        mode,
        instruction: body.instruction ?? null,
        baseVariantId: body.baseVariantId ?? null,
      });
      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "visual", "visual");
      if (mode === "replace") {
        await markDownstreamStale(run.id, "visual");
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
        failures,
        autoSelected: autoSelected?.id ?? null,
      });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Visual 생성 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
