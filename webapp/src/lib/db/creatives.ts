import { createAdminClient } from "@/lib/supabase/admin";

export async function getCreatives(campaignId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creatives")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCreative(params: {
  campaignId: string;
  channel: string;
  aspectRatio: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creatives")
    .insert({
      campaign_id: params.campaignId,
      channel: params.channel,
      aspect_ratio: params.aspectRatio,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCreative(id: string, updates: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creatives")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
