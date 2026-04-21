import {
  createVariants,
  getCampaign,
  getLatestRun,
  getStage,
  listVariants,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import { composeAd, LOGO_POSITIONS, type LogoPosition } from "@/lib/canvas/compositor";
import { buildComposeSource } from "@/lib/canvas/compose-from-run";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const BodySchema = z
  .object({
    logoPosition: z.enum(LOGO_POSITIONS as [LogoPosition, ...LogoPosition[]]).optional(),
    logoSizeRatio: z.number().min(0.06).max(0.3).optional(),
    logoXRatio: z.number().min(0).max(1).optional(),
    logoYRatio: z.number().min(0).max(1).optional(),
  })
  .optional();

export const maxDuration = 60;
const COMPOSE_PROMPT_VERSION = "compose@2.0.0";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const run = await getLatestRun(campaignId);
    if (!run) return ok({ run: null, stage: null, variants: [] });
    const stage = await getStage(run.id, "compose");
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

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    let overrides: {
      logoPosition?: LogoPosition;
      logoSizeRatio?: number;
      logoXRatio?: number;
      logoYRatio?: number;
    } = {};
    try {
      const raw = await request.json();
      const parsed = BodySchema.parse(raw);
      if (parsed) overrides = parsed;
    } catch {}

    const source = await buildComposeSource(campaignId, run.id);
    const stage = await upsertStage(run.id, "compose", {
      base_source: source.baseSource,
    });

    try {
      const identity = source.memory.identity;
      const logos = identity?.logo_urls_json ?? {};
      const logoUrl = logos.full ?? logos.light ?? logos.icon ?? null;
      const position: LogoPosition = overrides.logoPosition ?? source.logoDefaults.position;
      const widthRatio = overrides.logoSizeRatio ?? source.logoDefaults.widthRatio;
      const isCustomCoords =
        overrides.logoXRatio != null && overrides.logoYRatio != null;
      const defaultsSource =
        isCustomCoords || overrides.logoPosition || overrides.logoSizeRatio
          ? "user"
          : source.logoDefaults.source;

      let resultUrl: string;
      let outputPath: string;
      let logoApplied = false;

      if (logoUrl) {
        outputPath = `${campaignId}/compose/${Date.now()}.png`;
        resultUrl = await composeAd({
          backgroundImageUrl: source.baseUrl,
          output: { bucket: "generated-images", path: outputPath },
          overlay: { top: false, bottom: false },
          logo: {
            url: logoUrl,
            position: isCustomCoords ? undefined : position,
            widthRatio,
            marginRatio: 0.04,
            xRatio: overrides.logoXRatio,
            yRatio: overrides.logoYRatio,
          },
        });
        logoApplied = true;
      } else {
        outputPath = `${campaignId}/compose/${Date.now()}_passthrough`;
        resultUrl = source.baseUrl;
      }

      const label = `compose_${Date.now()}`;
      const [variant] = await createVariants(
        stage.id,
        [
          {
            label,
            content: {
              url: resultUrl,
              path: outputPath,
              baseUrl: source.baseUrl,
              baseSource: source.baseSource,
              logoApplied,
              logoPosition: logoApplied && !isCustomCoords ? position : null,
              logoSizeRatio: logoApplied ? widthRatio : null,
              logoXRatio: logoApplied && isCustomCoords ? overrides.logoXRatio : null,
              logoYRatio: logoApplied && isCustomCoords ? overrides.logoYRatio : null,
              logoSource: defaultsSource,
            },
            promptVersion: COMPOSE_PROMPT_VERSION,
          },
        ],
        { mode: "replace", instruction: null },
      );

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "compose", "compose");
      return ok({
        stage,
        variant,
        logoApplied,
        appliedPosition: position,
        appliedSize: widthRatio,
      });
    } catch (genErr) {
      const msg = genErr instanceof Error ? genErr.message : String(genErr);
      await setStageStatus(stage.id, "failed", msg);
      throw new ApiError(500, `Compose 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
