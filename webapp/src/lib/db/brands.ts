import { createAdminClient } from "@/lib/supabase/admin";

export async function getBrands() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBrand(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createBrand(name: string, websiteUrl?: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({ name, website_url: websiteUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBrandStyleGuide(id: string, styleGuide: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .update({ style_guide_json: styleGuide })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
