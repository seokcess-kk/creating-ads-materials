import { createClient } from "@/lib/supabase/server";
import type {
  BrandKeyVisual,
  KeyVisualFocalArea,
  KeyVisualKind,
} from "./types";

export async function listKeyVisuals(brandId: string): Promise<BrandKeyVisual[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_key_visuals")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandKeyVisual[];
}

export async function getKeyVisual(id: string): Promise<BrandKeyVisual | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_key_visuals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandKeyVisual | null) ?? null;
}

export async function listKeyVisualsByIds(ids: string[]): Promise<BrandKeyVisual[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_key_visuals")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as BrandKeyVisual[];
}

export interface KeyVisualInput {
  storage_url: string;
  kind: KeyVisualKind;
  label: string;
  description?: string | null;
  focal_area?: KeyVisualFocalArea | null;
  mood_tags?: string[];
  is_primary?: boolean;
}

export async function createKeyVisual(
  brandId: string,
  input: KeyVisualInput,
): Promise<BrandKeyVisual> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_key_visuals")
    .insert({
      brand_id: brandId,
      storage_url: input.storage_url,
      kind: input.kind,
      label: input.label,
      description: input.description ?? null,
      focal_area: input.focal_area ?? null,
      mood_tags: input.mood_tags ?? [],
      is_primary: input.is_primary ?? false,
      vision_status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrandKeyVisual;
}

export interface KeyVisualUpdate {
  label?: string;
  description?: string | null;
  focal_area?: KeyVisualFocalArea | null;
  mood_tags?: string[];
  is_primary?: boolean;
}

export async function updateKeyVisual(
  id: string,
  patch: KeyVisualUpdate,
): Promise<BrandKeyVisual> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_key_visuals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as BrandKeyVisual;
}

export async function setKeyVisualVisionResult(
  id: string,
  patch: { description?: string | null; mood_tags?: string[] },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_key_visuals")
    .update({
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.mood_tags !== undefined ? { mood_tags: patch.mood_tags } : {}),
      vision_status: "ready",
      vision_error: null,
      vision_analyzed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setKeyVisualVisionFailed(
  id: string,
  errorMsg: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_key_visuals")
    .update({
      vision_status: "failed",
      vision_error: errorMsg,
      vision_analyzed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteKeyVisual(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_key_visuals").delete().eq("id", id);
  if (error) throw error;
}
