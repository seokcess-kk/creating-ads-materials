import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandFontPair, FontRole } from "./types";

/** 브랜드 기본 폰트 (campaign_id IS NULL). loadBrandMemory에서 사용. */
export async function listFontPairs(brandId: string): Promise<BrandFontPair[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_font_pairs")
    .select("*")
    .eq("brand_id", brandId)
    .is("campaign_id", null);
  if (error) throw error;
  return (data ?? []) as BrandFontPair[];
}

/** 특정 캠페인의 오버라이드 폰트만. 없으면 빈 배열. */
export async function listCampaignFontPairs(
  brandId: string,
  campaignId: string,
): Promise<BrandFontPair[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_font_pairs")
    .select("*")
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId);
  if (error) throw error;
  return (data ?? []) as BrandFontPair[];
}

/**
 * 캠페인 컨텍스트에서 role의 실효 폰트 pair를 반환.
 * 우선순위: campaign 오버라이드 → brand 기본. 없으면 null.
 */
export async function resolveFontPairsForCampaign(
  brandId: string,
  campaignId: string,
): Promise<Record<FontRole, BrandFontPair | null>> {
  const [brandDefaults, overrides] = await Promise.all([
    listFontPairs(brandId),
    listCampaignFontPairs(brandId, campaignId),
  ]);
  const byRole: Record<string, BrandFontPair | null> = {};
  for (const p of brandDefaults) byRole[p.role] = p;
  for (const p of overrides) byRole[p.role] = p; // 오버라이드가 후승
  return byRole as Record<FontRole, BrandFontPair | null>;
}

export interface UpsertFontPairOptions {
  campaignId?: string | null;
  hierarchyRatio?: number;
}

export async function upsertFontPair(
  brandId: string,
  role: FontRole,
  fontId: string,
  options: UpsertFontPairOptions | number = {},
): Promise<BrandFontPair> {
  // Back-compat: 과거 시그니처 upsertFontPair(brandId, role, fontId, hierarchyRatio: number)
  const opts: UpsertFontPairOptions =
    typeof options === "number" ? { hierarchyRatio: options } : options;
  const campaignId = opts.campaignId ?? null;
  const hierarchyRatio = opts.hierarchyRatio ?? 1.0;

  const supabase = createAdminClient();

  // partial unique index 충돌을 피하기 위해 수동으로 select → insert/update 분기.
  const query = supabase
    .from("brand_font_pairs")
    .select("id")
    .eq("brand_id", brandId)
    .eq("role", role);
  const existing = campaignId
    ? await query.eq("campaign_id", campaignId).maybeSingle()
    : await query.is("campaign_id", null).maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data?.id) {
    const { data, error } = await supabase
      .from("brand_font_pairs")
      .update({ font_id: fontId, hierarchy_ratio: hierarchyRatio })
      .eq("id", existing.data.id)
      .select()
      .single();
    if (error) throw error;
    return data as BrandFontPair;
  }

  const { data, error } = await supabase
    .from("brand_font_pairs")
    .insert({
      brand_id: brandId,
      campaign_id: campaignId,
      role,
      font_id: fontId,
      hierarchy_ratio: hierarchyRatio,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrandFontPair;
}

export async function deleteFontPair(
  brandId: string,
  role: FontRole,
  options: { campaignId?: string | null } = {},
): Promise<void> {
  const supabase = createAdminClient();
  const campaignId = options.campaignId ?? null;
  let query = supabase
    .from("brand_font_pairs")
    .delete()
    .eq("brand_id", brandId)
    .eq("role", role);
  query = campaignId
    ? query.eq("campaign_id", campaignId)
    : query.is("campaign_id", null);
  const { error } = await query;
  if (error) throw error;
}

/** 캠페인의 모든 오버라이드를 한 번에 삭제 — "브랜드 기본으로 복귀" 용도. */
export async function clearCampaignFontOverrides(
  brandId: string,
  campaignId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_font_pairs")
    .delete()
    .eq("brand_id", brandId)
    .eq("campaign_id", campaignId);
  if (error) throw error;
}
