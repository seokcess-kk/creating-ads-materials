import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandIdentity, BrandVoice, BrandColor, BrandLogo } from "./types";

export async function getIdentity(brandId: string): Promise<BrandIdentity | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_identity")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandIdentity | null) ?? null;
}

export interface IdentityInput {
  voice?: BrandVoice;
  taboos?: string[];
  colors?: BrandColor[];
  logos?: BrandLogo[];
}

export async function upsertIdentity(
  brandId: string,
  input: IdentityInput,
): Promise<BrandIdentity> {
  const supabase = createAdminClient();
  const payload = {
    brand_id: brandId,
    voice_json: input.voice ?? {},
    taboos: input.taboos ?? [],
    colors_json: input.colors ?? [],
    logos_json: input.logos ?? [],
  };
  const { data, error } = await supabase
    .from("brand_identity")
    .upsert(payload, { onConflict: "brand_id" })
    .select()
    .single();
  if (error) throw error;
  return data as BrandIdentity;
}

export function getPrimaryLogo(logos: BrandLogo[]): BrandLogo | null {
  if (logos.length === 0) return null;
  return logos.find((l) => l.is_primary) ?? logos[0];
}
