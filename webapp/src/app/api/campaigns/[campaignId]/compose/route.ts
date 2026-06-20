import {
  createVariants,
  getCampaign,
  getStage,
  listVariants,
  resolveRun,
  selectVariant,
  setStageStatus,
  updateRunStatus,
  upsertStage,
} from "@/lib/campaigns";
import {
  composeAd,
  LOGO_POSITIONS,
  type ComposeConfig,
  type LogoPosition,
} from "@/lib/canvas/compositor";
import { buildComposeSource } from "@/lib/canvas/compose-from-run";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

const BodySchema = z
  .object({
    logoPosition: z.enum(LOGO_POSITIONS as [LogoPosition, ...LogoPosition[]]).optional(),
    logoSizeRatio: z.number().min(0.06).max(0.3).optional(),
    logoXRatio: z.number().min(0).max(1).optional(),
    logoYRatio: z.number().min(0).max(1).optional(),
    logoId: z.string().uuid().optional(),
    logoUrl: z.string().url().optional(),
  })
  .optional();

export const maxDuration = 60;
const COMPOSE_PROMPT_VERSION = "compose@2.0.0";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const runIdHint = new URL(request.url).searchParams.get("runId");
    const run = await resolveRun(campaignId, runIdHint);
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

    const runIdHint = new URL(request.url).searchParams.get("runId");
    const run = await resolveRun(campaignId, runIdHint);
    if (!run) throw new ApiError(400, "실행이 없습니다");

    let overrides: {
      logoPosition?: LogoPosition;
      logoSizeRatio?: number;
      logoXRatio?: number;
      logoYRatio?: number;
      logoId?: string;
      logoUrl?: string;
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
      const logos = identity?.logos_json ?? [];
      // Override > primary > first
      let logoUrl: string | null = null;
      let selectedLogoId: string | null = null;
      if (overrides.logoUrl) {
        logoUrl = overrides.logoUrl;
        selectedLogoId =
          logos.find((l) => l.url === overrides.logoUrl)?.id ?? null;
      } else if (overrides.logoId) {
        const found = logos.find((l) => l.id === overrides.logoId);
        logoUrl = found?.url ?? null;
        selectedLogoId = found?.id ?? null;
      } else {
        const primary = logos.find((l) => l.is_primary) ?? logos[0] ?? null;
        logoUrl = primary?.url ?? null;
        selectedLogoId = primary?.id ?? null;
      }
      const position: LogoPosition = overrides.logoPosition ?? source.logoDefaults.position;
      const widthRatio = overrides.logoSizeRatio ?? source.logoDefaults.widthRatio;
      const isCustomCoords =
        overrides.logoXRatio != null && overrides.logoYRatio != null;
      const defaultsSource =
        isCustomCoords || overrides.logoPosition || overrides.logoSizeRatio
          ? "user"
          : source.logoDefaults.source;

      // notice 모드: 텍스트를 배경에 굽지 않고 여기서 컴포지터로 오버레이.
      // visual 단계가 textless 배경을 생성하므로 이중 텍스트가 아니며,
      // 카피만 바꾼 뒤 compose 재실행 시 배경을 그대로 둔 채 텍스트만 갱신된다.
      const isNotice = campaign.content_mode === "notice";

      let resultUrl: string;
      let outputPath: string;
      let logoApplied = false;
      let textOverlaid = false;

      if (logoUrl || isNotice) {
        outputPath = `${campaignId}/compose/${Date.now()}.png`;
        const config: ComposeConfig = {
          backgroundImageUrl: source.baseUrl,
          output: { bucket: "generated-images", path: outputPath },
          overlay: isNotice
            ? { top: true, topOpacity: 150, bottom: true, bottomOpacity: 200 }
            : { top: false, bottom: false },
        };
        if (isNotice) {
          // 중립 톤(프리미엄 골드 강제 해제). 폰트는 캠페인 fontSet 사용.
          config.fontSet = source.fontSet;
          config.mainCopy = {
            text: source.copy.headline,
            color: "#FFFFFF",
            sizeRatio: 0.052,
            yRatio: 0.28,
            center: true,
            autoFit: true,
            maxLines: 3,
            maxWidthRatio: 0.86,
          };
          config.subCopy = {
            text: source.copy.subCopy,
            color: "#E5E7EB",
            sizeRatio: 0.028,
            yRatio: 0.62,
            center: true,
            autoFit: true,
            maxLines: 2,
            maxWidthRatio: 0.86,
          };
          config.cta = {
            text: source.copy.cta,
            bgColor: "#1F2937",
            textColor: "#FFFFFF",
            sizeRatio: 0.028,
            yRatio: 0.84,
            autoFit: true,
            maxWidthRatio: 0.78,
          };
          textOverlaid = true;
        }
        if (logoUrl) {
          config.logo = {
            url: logoUrl,
            position: isCustomCoords ? undefined : position,
            widthRatio,
            marginRatio: 0.04,
            xRatio: overrides.logoXRatio,
            yRatio: overrides.logoYRatio,
          };
          logoApplied = true;
        }
        resultUrl = await composeAd(config);
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
              textOverlaid,
              logoApplied,
              logoPosition: logoApplied && !isCustomCoords ? position : null,
              logoSizeRatio: logoApplied ? widthRatio : null,
              logoXRatio: logoApplied && isCustomCoords ? overrides.logoXRatio : null,
              logoYRatio: logoApplied && isCustomCoords ? overrides.logoYRatio : null,
              logoSource: defaultsSource,
              logoId: selectedLogoId,
              logoUrl: logoApplied ? logoUrl : null,
            },
            promptVersion: COMPOSE_PROMPT_VERSION,
          },
        ],
        { mode: "replace", instruction: null },
      );

      await setStageStatus(stage.id, "ready");
      await updateRunStatus(run.id, "compose", "compose");

      // compose는 항상 단일 variant(replace)이므로 auto/assist에서는 자동 선택 후
      // Ship 단계로 승격한다(확정 클릭 제거). manual은 ComposeStage에서 직접 확정.
      let shipReady = false;
      if (campaign.automation_level !== "manual") {
        await selectVariant(stage.id, variant.id);
        await updateRunStatus(run.id, "ship", "ship");
        shipReady = true;
      }

      return ok({
        stage,
        variant: shipReady ? { ...variant, selected: true } : variant,
        logoApplied,
        appliedPosition: position,
        appliedSize: widthRatio,
        autoSelected: shipReady,
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
