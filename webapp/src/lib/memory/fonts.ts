import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandFontPair, FontRole } from "./types";

export async function listFontPairs(brandId: string): Promise<BrandFontPair[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_font_pairs")
    .select("*")
    .eq("brand_id", brandId);
  if (error) throw error;
  return (data ?? []) as BrandFontPair[];
}

export async function upsertFontPair(
  brandId: string,
  role: FontRole,
  fontId: string,
  hierarchyRatio: number = 1.0,
): Promise<BrandFontPair> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_font_pairs")
    .upsert(
      {
        brand_id: brandId,
        role,
        font_id: fontId,
        hierarchy_ratio: hierarchyRatio,
      },
      { onConflict: "brand_id,role" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as BrandFontPair;
}

export async function deleteFontPair(brandId: string, role: FontRole): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_font_pairs")
    .delete()
    .eq("brand_id", brandId)
    .eq("role", role);
  if (error) throw error;
}
