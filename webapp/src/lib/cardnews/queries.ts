import { createClient } from "@/lib/supabase/server";
import type { CardNewsRecord, CardNewsResult } from "./types";

export async function getCardNews(campaignId: string): Promise<CardNewsRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cardnews")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return (data as CardNewsRecord | null) ?? null;
}

export async function upsertCardNews(
  campaignId: string,
  result: CardNewsResult,
  promptVersion: string,
): Promise<CardNewsRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cardnews")
    .upsert(
      {
        campaign_id: campaignId,
        title: result.title,
        bg_url: result.bgUrl,
        slides_json: result.slides,
        status: "ready",
        prompt_version: promptVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CardNewsRecord;
}
