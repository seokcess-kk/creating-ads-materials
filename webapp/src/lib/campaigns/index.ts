import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Campaign,
  CampaignIntent,
  CreativeRun,
  CreativeStageName,
  CreativeStageRow,
  CreativeVariant,
  RunStatus,
  StageStatus,
} from "./types";

export * from "./types";

export async function listCampaigns(brandId: string): Promise<Campaign[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return (data as Campaign | null) ?? null;
}

export async function createCampaign(
  brandId: string,
  intent: CampaignIntent,
): Promise<Campaign> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      brand_id: brandId,
      name: intent.name,
      goal: intent.goal,
      offer_id: intent.offer_id,
      audience_id: intent.audience_id,
      channel: intent.channel,
      constraints_json: intent.constraints ?? {},
    })
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<CampaignIntent & { status: Campaign["status"] }>,
): Promise<Campaign> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.goal !== undefined) updates.goal = patch.goal;
  if (patch.offer_id !== undefined) updates.offer_id = patch.offer_id;
  if (patch.audience_id !== undefined) updates.audience_id = patch.audience_id;
  if (patch.channel !== undefined) updates.channel = patch.channel;
  if (patch.constraints !== undefined) updates.constraints_json = patch.constraints;
  if (patch.status !== undefined) updates.status = patch.status;

  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", campaignId)
    .select()
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
  if (error) throw error;
}

// Runs

export async function createRun(campaignId: string): Promise<CreativeRun> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_runs")
    .insert({ campaign_id: campaignId, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as CreativeRun;
}

export async function getLatestRun(campaignId: string): Promise<CreativeRun | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CreativeRun | null) ?? null;
}

export async function rateRun(
  runId: string,
  rating: number | null,
  note: string | null,
): Promise<CreativeRun> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_runs")
    .update({
      rating,
      note,
      rated_at: rating != null ? new Date().toISOString() : null,
    })
    .eq("id", runId)
    .select()
    .single();
  if (error) throw error;
  return data as CreativeRun;
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus,
  currentStage?: CreativeStageName,
): Promise<void> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (currentStage !== undefined) updates.current_stage = currentStage;
  if (status === "complete") updates.completed_at = new Date().toISOString();
  const { error } = await supabase.from("creative_runs").update(updates).eq("id", runId);
  if (error) throw error;
}

// Stages

export async function upsertStage(
  runId: string,
  stage: CreativeStageName,
  input?: Record<string, unknown>,
): Promise<CreativeStageRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_stages")
    .upsert(
      {
        run_id: runId,
        stage,
        status: "running",
        input_json: input ?? {},
        started_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: "run_id,stage" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CreativeStageRow;
}

export async function setStageStatus(
  stageId: string,
  status: StageStatus,
  errorMsg?: string,
): Promise<void> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "ready" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }
  if (errorMsg !== undefined) updates.error = errorMsg;
  const { error } = await supabase.from("creative_stages").update(updates).eq("id", stageId);
  if (error) throw error;
}

export async function getStage(
  runId: string,
  stage: CreativeStageName,
): Promise<CreativeStageRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_stages")
    .select("*")
    .eq("run_id", runId)
    .eq("stage", stage)
    .maybeSingle();
  if (error) throw error;
  return (data as CreativeStageRow | null) ?? null;
}

export async function listStages(runId: string): Promise<CreativeStageRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_stages")
    .select("*")
    .eq("run_id", runId);
  if (error) throw error;
  return (data ?? []) as CreativeStageRow[];
}

// Variants

export async function createVariants(
  stageId: string,
  variants: Array<{
    label: string;
    content: Record<string, unknown>;
    scores?: Record<string, unknown>;
    promptVersion?: string;
  }>,
): Promise<CreativeVariant[]> {
  const supabase = createAdminClient();
  const payload = variants.map((v) => ({
    stage_id: stageId,
    label: v.label,
    content_json: v.content,
    scores_json: v.scores ?? {},
    prompt_version: v.promptVersion ?? null,
    selected: false,
  }));
  const { data, error } = await supabase.from("creative_variants").insert(payload).select();
  if (error) throw error;
  return (data ?? []) as CreativeVariant[];
}

export async function listVariants(stageId: string): Promise<CreativeVariant[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_variants")
    .select("*")
    .eq("stage_id", stageId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as CreativeVariant[];
}

export async function selectVariant(
  stageId: string,
  variantId: string,
): Promise<CreativeVariant> {
  const supabase = createAdminClient();
  await supabase
    .from("creative_variants")
    .update({ selected: false })
    .eq("stage_id", stageId);
  const { data, error } = await supabase
    .from("creative_variants")
    .update({ selected: true })
    .eq("id", variantId)
    .select()
    .single();
  if (error) throw error;
  return data as CreativeVariant;
}

export async function getSelectedVariant(
  runId: string,
  stage: CreativeStageName,
): Promise<CreativeVariant | null> {
  const stageRow = await getStage(runId, stage);
  if (!stageRow) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_variants")
    .select("*")
    .eq("stage_id", stageRow.id)
    .eq("selected", true)
    .maybeSingle();
  if (error) throw error;
  return (data as CreativeVariant | null) ?? null;
}
