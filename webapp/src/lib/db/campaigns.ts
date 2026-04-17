import { createAdminClient } from "@/lib/supabase/admin";

export async function getCampaigns(brandId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getCampaign(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCampaign(params: {
  brandId: string;
  name: string;
  description?: string;
  targetChannels: string[];
  colorOverride?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: params.brandId,
      name: params.name,
      description: params.description,
      target_channels: params.targetChannels,
      color_override_json: params.colorOverride || {},
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCampaign(id: string, updates: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
