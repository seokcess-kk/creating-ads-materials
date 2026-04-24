import { createClient } from "@/lib/supabase/server";
import { getSelectedVariant } from "@/lib/campaigns";
import { listReferences, updateReferenceWeight } from "@/lib/memory/references";
import type { BrandReference } from "@/lib/memory/types";
import { normalizeLogoPosition } from "@/lib/canvas/compose-from-run";

export interface RunSignals {
  hookType?: string | null;
  frameworkId?: string | null;
  logoPosition?: string | null;
  visualFocus?: string | null;
}

export interface BPFeedbackRow {
  id: string;
  run_id: string;
  reference_id: string;
  applied_rating: number;
  delta: number;
  match_score: number;
  signals_json: RunSignals | null;
  applied_at: string;
}

export interface BPFeedbackApplyResult {
  reverted: number;
  applied: Array<{
    referenceId: string;
    delta: number;
    matchScore: number;
    newWeight: number;
  }>;
  signals: RunSignals;
  skippedReason?: "no-rating" | "no-signals" | "no-brand-refs";
}

const STRATEGY_HOOK_WEIGHT = 1.5;
const FRAMEWORK_WEIGHT = 1.0;
const LOGO_POSITION_WEIGHT = 0.8;
const VISUAL_FOCUS_WEIGHT = 0.5;
const MIN_MATCH_SCORE = 0.25;
const MATCH_NORMALIZATION_MAX =
  STRATEGY_HOOK_WEIGHT +
  FRAMEWORK_WEIGHT +
  LOGO_POSITION_WEIGHT +
  VISUAL_FOCUS_WEIGHT;

// 1→-8, 2→-4, 3→0, 4→+4, 5→+8
function deltaFromRating(rating: number): number {
  return (rating - 3) * 4;
}

async function extractRunSignals(runId: string): Promise<RunSignals> {
  const [strategyV, visualV, composeV] = await Promise.all([
    getSelectedVariant(runId, "strategy"),
    getSelectedVariant(runId, "visual"),
    getSelectedVariant(runId, "compose"),
  ]);
  const sc = (strategyV?.content_json ?? {}) as Record<string, unknown>;
  const vc = (visualV?.content_json ?? {}) as Record<string, unknown>;
  const cc = (composeV?.content_json ?? {}) as Record<string, unknown>;
  return {
    hookType: typeof sc.hookType === "string" ? sc.hookType : null,
    frameworkId: typeof sc.frameworkId === "string" ? sc.frameworkId : null,
    visualFocus: typeof vc.focus === "string" ? vc.focus : null,
    logoPosition: typeof cc.logoPosition === "string" ? cc.logoPosition : null,
  };
}

async function getBrandIdForRun(runId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_runs")
    .select("campaign_id, campaigns!inner(brand_id)")
    .eq("id", runId)
    .maybeSingle();
  if (error || !data) return null;
  const campaigns = (data as { campaigns?: { brand_id?: string } }).campaigns;
  return campaigns?.brand_id ?? null;
}

function computeMatchScore(r: BrandReference, signals: RunSignals): number {
  const a = r.vision_analysis_json;
  let score = 0;
  if (signals.hookType && a.copyStructure?.hookType) {
    if (a.copyStructure.hookType === signals.hookType) score += STRATEGY_HOOK_WEIGHT;
  }
  if (signals.frameworkId && a.copyStructure?.framework) {
    if (a.copyStructure.framework === signals.frameworkId) score += FRAMEWORK_WEIGHT;
  }
  if (signals.logoPosition && a.brandElements?.logoPosition) {
    const bpPos = normalizeLogoPosition(a.brandElements.logoPosition);
    if (bpPos && bpPos === signals.logoPosition) score += LOGO_POSITION_WEIGHT;
  }
  if (signals.visualFocus && a.hookElement?.type) {
    const f = signals.visualFocus.toLowerCase();
    const h = a.hookElement.type.toLowerCase();
    if (h.includes(f) || f.includes(h)) score += VISUAL_FOCUS_WEIGHT;
  }
  return score / MATCH_NORMALIZATION_MAX;
}

async function fetchExistingFeedback(runId: string): Promise<BPFeedbackRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bp_rating_feedback")
    .select("*")
    .eq("run_id", runId);
  if (error) throw error;
  return (data ?? []) as BPFeedbackRow[];
}

async function deleteExistingFeedback(runId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bp_rating_feedback")
    .delete()
    .eq("run_id", runId);
  if (error) throw error;
}

async function insertFeedback(
  rows: Array<Omit<BPFeedbackRow, "id" | "applied_at">>,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("bp_rating_feedback").insert(rows);
  if (error) throw error;
}

function clampWeight(w: number): number {
  return Math.max(0, Math.min(100, Math.round(w)));
}

/**
 * Ship 평점이 설정/변경/취소될 때 호출.
 * 이 run에 대해 이전에 적용한 feedback을 모두 역산(reverse)하고,
 * 새 평점이 있다면 signals 기반 match score로 BP weight를 재조정한다.
 */
export async function applyRatingToBPWeights(
  runId: string,
  newRating: number | null,
): Promise<BPFeedbackApplyResult> {
  const result: BPFeedbackApplyResult = {
    reverted: 0,
    applied: [],
    signals: {},
  };

  // 1) 기존 feedback 역산
  const existing = await fetchExistingFeedback(runId);
  if (existing.length > 0) {
    for (const row of existing) {
      const supabase = await createClient();
      const { data: ref } = await supabase
        .from("brand_references")
        .select("id, weight")
        .eq("id", row.reference_id)
        .maybeSingle();
      if (!ref) continue;
      const reverted = clampWeight((ref.weight as number) - row.delta);
      await updateReferenceWeight(row.reference_id, reverted);
      result.reverted += 1;
    }
    await deleteExistingFeedback(runId);
  }

  // 2) 새 평점이 null이면 역산만 하고 끝.
  if (newRating == null) {
    result.skippedReason = "no-rating";
    return result;
  }

  const delta = deltaFromRating(newRating);
  if (delta === 0) return result;

  // 3) signals 추출
  const signals = await extractRunSignals(runId);
  result.signals = signals;
  if (
    !signals.hookType &&
    !signals.frameworkId &&
    !signals.logoPosition &&
    !signals.visualFocus
  ) {
    result.skippedReason = "no-signals";
    return result;
  }

  const brandId = await getBrandIdForRun(runId);
  if (!brandId) {
    result.skippedReason = "no-brand-refs";
    return result;
  }

  const refs = await listReferences(brandId);
  const eligible = refs.filter(
    (r) => r.vision_status === "ready" && !r.is_negative,
  );
  if (eligible.length === 0) {
    result.skippedReason = "no-brand-refs";
    return result;
  }

  // 4) match score 계산 → delta 적용
  const feedbackRows: Array<Omit<BPFeedbackRow, "id" | "applied_at">> = [];
  for (const r of eligible) {
    const matchScore = computeMatchScore(r, signals);
    if (matchScore < MIN_MATCH_SCORE) continue;
    const appliedDelta = Math.round(delta * matchScore);
    if (appliedDelta === 0) continue;
    const newWeight = clampWeight((r.weight ?? 50) + appliedDelta);
    if (newWeight === r.weight) continue;
    await updateReferenceWeight(r.id, newWeight);
    feedbackRows.push({
      run_id: runId,
      reference_id: r.id,
      applied_rating: newRating,
      delta: appliedDelta,
      match_score: Number(matchScore.toFixed(3)),
      signals_json: signals,
    });
    result.applied.push({
      referenceId: r.id,
      delta: appliedDelta,
      matchScore,
      newWeight,
    });
  }

  await insertFeedback(feedbackRows);
  return result;
}
