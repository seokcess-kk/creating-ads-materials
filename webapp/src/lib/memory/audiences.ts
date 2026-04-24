import { createClient } from "@/lib/supabase/server";
import type { BrandAudience } from "./types";

export async function listAudiences(brandId: string): Promise<BrandAudience[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_audiences")
    .select("*")
    .eq("brand_id", brandId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandAudience[];
}

export async function getAudience(audienceId: string): Promise<BrandAudience | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_audiences")
    .select("*")
    .eq("id", audienceId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandAudience | null) ?? null;
}

export interface AudienceInput {
  persona_name: string;
  demographics?: Record<string, unknown>;
  language_level?: string | null;
  pains?: string[];
  desires?: string[];
  notes?: string | null;
  is_default?: boolean;
}

async function clearDefault(brandId: string) {
  const supabase = await createClient();
  await supabase.from("brand_audiences").update({ is_default: false }).eq("brand_id", brandId);
}

export async function createAudience(
  brandId: string,
  input: AudienceInput,
): Promise<BrandAudience> {
  const supabase = await createClient();
  if (input.is_default) await clearDefault(brandId);
  const { data, error } = await supabase
    .from("brand_audiences")
    .insert({
      brand_id: brandId,
      persona_name: input.persona_name,
      demographics: input.demographics ?? {},
      language_level: input.language_level ?? null,
      pains: input.pains ?? [],
      desires: input.desires ?? [],
      notes: input.notes ?? null,
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrandAudience;
}

export async function updateAudience(
  audienceId: string,
  input: Partial<AudienceInput>,
): Promise<BrandAudience> {
  const supabase = await createClient();
  if (input.is_default) {
    const existing = await getAudience(audienceId);
    if (existing) await clearDefault(existing.brand_id);
  }
  const { data, error } = await supabase
    .from("brand_audiences")
    .update(input)
    .eq("id", audienceId)
    .select()
    .single();
  if (error) throw error;
  return data as BrandAudience;
}

export async function deleteAudience(audienceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_audiences").delete().eq("id", audienceId);
  if (error) throw error;
}
