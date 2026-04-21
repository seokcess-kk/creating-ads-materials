import { z } from "zod";
import { getCampaign } from "@/lib/campaigns";
import {
  clearCampaignFontOverrides,
  listCampaignFontPairs,
  upsertFontPair,
} from "@/lib/memory/fonts";
import {
  getPresetById,
  TONE_PRESETS,
  type TonePresetId,
} from "@/lib/fonts/tone-pairs";
import { resolveFontForPresetRole, type ResolveSource } from "@/lib/fonts/resolver";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import type { FontRole } from "@/lib/memory/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");
    const pairs = await listCampaignFontPairs(campaign.brand_id, campaignId);
    return ok({ pairs });
  } catch (e) {
    return serverError(e);
  }
}

const PostSchema = z.object({
  preset_id: z
    .enum(
      TONE_PRESETS.map((p) => p.id) as [TonePresetId, ...TonePresetId[]],
    )
    .nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const body = await parseJson(request, PostSchema);

    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    // preset_id === null → 오버라이드 해제 (브랜드 기본으로 복귀)
    if (body.preset_id === null) {
      await clearCampaignFontOverrides(campaign.brand_id, campaignId);
      return ok({ cleared: true, presetId: null, filled: [], missing: [] });
    }

    const preset = getPresetById(body.preset_id);
    if (!preset) throw new ApiError(400, "알 수 없는 프리셋");

    const filled: Array<{
      role: FontRole;
      family: string;
      weight: string;
      source: ResolveSource;
      requested: { family: string; weight: string };
    }> = [];
    const missing: Array<{ role: FontRole; family: string; weight: string }> = [];

    for (const role of Object.keys(preset.roles) as FontRole[]) {
      const resolved = await resolveFontForPresetRole(preset, role);
      if (!resolved) {
        const spec = preset.roles[role];
        missing.push({ role, family: spec.family, weight: spec.weight });
        continue;
      }
      await upsertFontPair(campaign.brand_id, role, resolved.font.id, {
        campaignId,
      });
      filled.push({
        role,
        family: resolved.font.family,
        weight: resolved.font.weight ?? resolved.requested.weight,
        source: resolved.source,
        requested: resolved.requested,
      });
    }

    return ok({
      cleared: false,
      presetId: preset.id,
      presetLabel: preset.label,
      filled,
      missing,
    });
  } catch (e) {
    return serverError(e);
  }
}
