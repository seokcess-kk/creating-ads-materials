import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandLearnings } from "./types";

export async function getLearnings(brandId: string): Promise<BrandLearnings | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_learnings")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandLearnings | null) ?? null;
}

export async function ensureLearnings(brandId: string): Promise<BrandLearnings> {
  const existing = await getLearnings(brandId);
  if (existing) return existing;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_learnings")
    .insert({ brand_id: brandId })
    .select()
    .single();
  if (error) throw error;
  return data as BrandLearnings;
}
