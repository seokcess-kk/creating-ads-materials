import { createClient } from "@/lib/supabase/server";
import type { BrandIdentity } from "./types";

export async function getIdentity(brandId: string): Promise<BrandIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_identity")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandIdentity | null) ?? null;
}
