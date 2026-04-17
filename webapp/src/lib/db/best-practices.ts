import { createAdminClient } from "@/lib/supabase/admin";

export async function getBestPractices(brandId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("best_practices")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createBestPractice(params: {
  brandId: string;
  fileUrl: string;
  fileName: string;
  source?: string;
  tags?: string[];
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("best_practices")
    .insert({
      brand_id: params.brandId,
      file_url: params.fileUrl,
      file_name: params.fileName,
      source: params.source,
      tags: params.tags || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBestPractice(id: string, updates: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("best_practices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBestPractice(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("best_practices")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
