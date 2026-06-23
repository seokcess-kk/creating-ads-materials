import { createClient } from "@/lib/supabase/server";
import type { Brand } from "./types";

export * from "./types";
export * from "./identity";

export async function getBrand(brandId: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as Brand | null) ?? null;
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Brand[];
}

export interface BrandInput {
  name: string;
  website_url?: string | null;
  category?: string | null;
  description?: string | null;
}

export async function createBrand(input: BrandInput): Promise<Brand> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({
      name: input.name,
      website_url: input.website_url ?? null,
      category: input.category ?? null,
      description: input.description ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Brand;
}

export async function updateBrand(
  brandId: string,
  input: Partial<BrandInput>,
): Promise<Brand> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .update(input)
    .eq("id", brandId)
    .select()
    .single();
  if (error) throw error;
  return data as Brand;
}

export async function deleteBrand(brandId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", brandId);
  if (error) throw error;
}
