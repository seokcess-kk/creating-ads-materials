import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandReference, ReferenceSource, VisionAnalysis } from "./types";

export async function listReferences(brandId: string): Promise<BrandReference[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_references")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandReference[];
}

export async function getReference(referenceId: string): Promise<BrandReference | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_references")
    .select("*")
    .eq("id", referenceId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandReference | null) ?? null;
}

export interface ReferenceInput {
  file_url: string;
  file_name?: string | null;
  source_type?: ReferenceSource;
  source_note?: string | null;
  is_negative?: boolean;
  weight?: number;
}

export async function createReference(
  brandId: string,
  input: ReferenceInput,
): Promise<BrandReference> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("brand_references")
    .insert({
      brand_id: brandId,
      file_url: input.file_url,
      file_name: input.file_name ?? null,
      source_type: input.source_type ?? "bp_upload",
      source_note: input.source_note ?? null,
      is_negative: input.is_negative ?? false,
      weight: input.weight ?? 50,
      vision_status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrandReference;
}

export async function updateReferenceWeight(referenceId: string, weight: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_references")
    .update({ weight })
    .eq("id", referenceId);
  if (error) throw error;
}

export async function setVisionResult(
  referenceId: string,
  analysis: VisionAnalysis,
  promptVersion: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_references")
    .update({
      vision_analysis_json: analysis,
      vision_prompt_version: promptVersion,
      vision_status: "ready",
      vision_error: null,
      vision_analyzed_at: new Date().toISOString(),
    })
    .eq("id", referenceId);
  if (error) throw error;
}

export async function setVisionFailed(referenceId: string, errorMsg: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_references")
    .update({
      vision_status: "failed",
      vision_error: errorMsg,
      vision_analyzed_at: new Date().toISOString(),
    })
    .eq("id", referenceId);
  if (error) throw error;
}

export async function setVisionPending(referenceId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("brand_references")
    .update({ vision_status: "pending", vision_error: null })
    .eq("id", referenceId);
  if (error) throw error;
}

export async function deleteReference(referenceId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("brand_references").delete().eq("id", referenceId);
  if (error) throw error;
}
