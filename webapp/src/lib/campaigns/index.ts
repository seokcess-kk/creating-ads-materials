import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BatchMode,
  BatchSummary,
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

export async function listAllCampaigns(
  filter?: { status?: Campaign["status"] },
): Promise<Campaign[]> {
  const supabase = createAdminClient();
  let q = supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (filter?.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export interface DashboardStats {
  campaigns: number;
  completed: number;
  running: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("campaigns").select("status");
  if (error) throw error;
  const rows = (data ?? []) as Array<{ status: Campaign["status"] }>;
  return {
    campaigns: rows.length,
    completed: rows.filter((r) => r.status === "completed").length,
    running: rows.filter((r) => r.status === "running").length,
  };
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
      automation_level: intent.automation_level ?? "assist",
      key_visual_intent: intent.key_visual_intent ?? null,
      selected_key_visual_ids: intent.selected_key_visual_ids ?? [],
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
  if (patch.automation_level !== undefined) {
    updates.automation_level = patch.automation_level;
  }
  if (patch.key_visual_intent !== undefined) {
    updates.key_visual_intent = patch.key_visual_intent;
  }
  if (patch.selected_key_visual_ids !== undefined) {
    updates.selected_key_visual_ids = patch.selected_key_visual_ids;
  }

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

const STAGE_ORDER: CreativeStageName[] = [
  "strategy",
  "copy",
  "visual",
  "retouch",
  "compose",
  "ship",
];

export async function markDownstreamStale(
  runId: string,
  fromStage: CreativeStageName,
): Promise<void> {
  const fromIndex = STAGE_ORDER.indexOf(fromStage);
  if (fromIndex < 0) return;
  const downstream = STAGE_ORDER.slice(fromIndex + 1);
  if (downstream.length === 0) return;
  const supabase = createAdminClient();
  // ready 상태만 stale로 전환 (pending/running/failed는 그대로)
  const { error } = await supabase
    .from("creative_stages")
    .update({ status: "stale" })
    .eq("run_id", runId)
    .in("stage", downstream)
    .eq("status", "ready");
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

// Batches

function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

async function nextBatchIndex(stageId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_variants")
    .select("batch_index")
    .eq("stage_id", stageId)
    .order("batch_index", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = data && data[0] ? (data[0].batch_index as number) : 0;
  return max + 1;
}

export async function archiveActiveBatches(stageId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("creative_variants")
    .update({ archived_at: new Date().toISOString() })
    .eq("stage_id", stageId)
    .is("archived_at", null);
  if (error) throw error;
}

export async function restoreBatch(
  stageId: string,
  batchId: string,
): Promise<void> {
  const supabase = createAdminClient();
  // 현재 활성 batch 모두 archive
  await archiveActiveBatches(stageId);
  // 대상 batch 활성화
  const { error } = await supabase
    .from("creative_variants")
    .update({ archived_at: null })
    .eq("stage_id", stageId)
    .eq("batch_id", batchId);
  if (error) throw error;
}

export interface NewBatch {
  mode: BatchMode;
  instruction?: string | null;
  baseVariantId?: string | null;
}

export async function createVariants(
  stageId: string,
  variants: Array<{
    label: string;
    content: Record<string, unknown>;
    scores?: Record<string, unknown>;
    promptVersion?: string;
  }>,
  batch: NewBatch,
): Promise<CreativeVariant[]> {
  const supabase = createAdminClient();

  if (batch.mode === "replace") {
    await archiveActiveBatches(stageId);
  }

  const batchId = randomUUID();
  const batchIndex = await nextBatchIndex(stageId);

  const payload = variants.map((v) => ({
    stage_id: stageId,
    label: v.label,
    content_json: v.content,
    scores_json: v.scores ?? {},
    prompt_version: v.promptVersion ?? null,
    selected: false,
    batch_id: batchId,
    batch_index: batchIndex,
    batch_mode: batch.mode,
    batch_instruction: batch.instruction ?? null,
    base_variant_id: batch.baseVariantId ?? null,
    archived_at: null,
  }));
  const { data, error } = await supabase.from("creative_variants").insert(payload).select();
  if (error) throw error;
  return (data ?? []) as CreativeVariant[];
}

export async function listVariants(
  stageId: string,
  options: { includeArchived?: boolean } = {},
): Promise<CreativeVariant[]> {
  const supabase = createAdminClient();
  let q = supabase.from("creative_variants").select("*").eq("stage_id", stageId);
  if (!options.includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q.order("created_at");
  if (error) throw error;
  return (data ?? []) as CreativeVariant[];
}

/**
 * 새로 생성된 variants 중 overall 점수가 가장 높은 것을 자동 선택.
 * Assist / Auto 모드에서 호출. 점수 없는 stage(strategy)는 첫 번째 variant 선택.
 */
export async function autoSelectBest(
  stageId: string,
  variants: CreativeVariant[],
): Promise<CreativeVariant | null> {
  if (variants.length === 0) return null;
  const scored = variants
    .map((v) => {
      const overall =
        ((v.scores_json as Record<string, unknown>)?.overall as number) ?? null;
      return { variant: v, overall };
    })
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const best = scored[0].variant;
  await selectVariant(stageId, best.id);
  return { ...best, selected: true };
}

export async function listBatches(stageId: string): Promise<BatchSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_variants")
    .select("batch_id, batch_index, batch_mode, batch_instruction, created_at, archived_at")
    .eq("stage_id", stageId)
    .order("batch_index", { ascending: false });
  if (error) throw error;

  const groups = new Map<string, BatchSummary>();
  for (const row of data ?? []) {
    const bid = row.batch_id as string;
    const existing = groups.get(bid);
    if (existing) {
      existing.variant_count += 1;
    } else {
      groups.set(bid, {
        batch_id: bid,
        batch_index: row.batch_index as number,
        batch_mode: row.batch_mode as BatchMode,
        batch_instruction: (row.batch_instruction as string | null) ?? null,
        created_at: row.created_at as string,
        variant_count: 1,
        archived: row.archived_at != null,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.batch_index - a.batch_index);
}

export async function getVariantById(
  variantId: string,
): Promise<CreativeVariant | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("creative_variants")
    .select("*")
    .eq("id", variantId)
    .maybeSingle();
  if (error) throw error;
  return (data as CreativeVariant | null) ?? null;
}

export async function selectVariant(
  stageId: string,
  variantId: string,
): Promise<CreativeVariant> {
  const supabase = createAdminClient();
  // 활성 배치 내에서만 선택 해제 (archived는 보존)
  await supabase
    .from("creative_variants")
    .update({ selected: false })
    .eq("stage_id", stageId)
    .is("archived_at", null);
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
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as CreativeVariant | null) ?? null;
}
