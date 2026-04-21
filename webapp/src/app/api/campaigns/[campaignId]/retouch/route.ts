import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
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
import type { CreativeVariant } from "@/lib/campaigns/types";
import { loadBrandMemory } from "@/lib/memory";
import { editImage, type AspectRatio } from "@/lib/engines/gemini-image";
import { getChannel } from "@/lib/channels";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import { RETOUCH_PROMPT_VERSION, buildRetouchPrompt } from "@/lib/prompts/retouch";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 180;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "retouch");
    const variants = stage ? await listVariants(stage.id) : [];
    return ok({ run, stage, variants });
  } catch (e) {
    return serverError(e);
  }
}

const RetouchSchema = z.object({
  instruction: z.string().min(1).max(500),
  baseVariantId: z.string().uuid().optional(),
  keepCompositionStrict: z.boolean().optional(),
  mode: z.enum(["replace", "add"]).optional(),
});

interface VariantContent {
  url?: string;
  path?: string;
  instruction?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const input = await parseJson(request, RetouchSchema);

    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    const selectedVisual = await getSelectedVariant(run.id, "visual");
    if (!selectedVisual) throw new ApiError(400, "선택된 Visual이 없습니다");

    const memory = await loadBrandMemory(campaign.brand_id);
    if (!memory) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    let baseUrl: string;
    let baseLabel: string;
    if (input.baseVariantId) {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("creative_variants")
        .select("*")
        .eq("id", input.baseVariantId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ApiError(404, "base variant 없음");
      const v = data as CreativeVariant;
      baseUrl = (v.content_json as VariantContent).url ?? "";
      baseLabel = v.label;
    } else {
      baseUrl = (selectedVisual.content_json as VariantContent).url ?? "";
      baseLabel = selectedVisual.label;
    }
    if (!baseUrl) throw new ApiError(400, "base 이미지 URL을 찾을 수 없습니다");

    const stage = await upsertStage(run.id, "retouch", {
      base_visual_variant_id: selectedVisual.id,
    });

    try {
      const channel = getChannel(campaign.channel);
      const aspectRatio = (channel?.aspectRatio ?? "1:1") as AspectRatio;
      const base = await fetchAsBase64(baseUrl);
      const edited = await editImage({
        prompt: buildRetouchPrompt({
          memory,
          instruction: input.instruction,
          keepCompositionStrict: input.keepCompositionStrict,
        }),
        baseImage: base,
        aspectRatio,
        imageSize: "2K",
        usageContext: {
          operation: "retouch",
          brandId: campaign.brand_id,
          campaignId,
        },
      });

      const turnLabel = `turn_${Date.now()}`;
      const { url, path } = await uploadGeneratedImage(
        campaignId,
        `retouch_${turnLabel}`,
        edited,
      );

      const [variant] = await createVariants(
        stage.id,
        [
          {
            label: turnLabel,
            content: {
              url,
              path,
              instruction: input.instruction,
              baseVariantId: input.baseVariantId ?? selectedVisual.id,
              baseLabel,
            },
            promptVersion: RETOUCH_PROMPT_VERSION,
          },
        ],
        {
          mode: input.mode ?? "add",
          instruction: input.instruction,
          baseVariantId: input.baseVariantId ?? selectedVisual.id,
        },
      );

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "retouch", "retouch");
      if ((input.mode ?? "add") === "replace") {
        await markDownstreamStale(run.id, "retouch");
      }

      return ok({ stage, variant });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Retouch 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
