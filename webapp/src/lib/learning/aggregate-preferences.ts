import { createAdminClient } from "@/lib/supabase/admin";

export interface PreferenceAggregation {
  hookCounts: Record<string, number>;
  frameworkCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  focusCounts: Record<string, number>;
  logoPositionCounts: Record<string, number>;
  retouchCategoryCounts: Record<string, number>;
  retouchTurnsTotal: number;
  retouchTurnsPerRun: number;
  totalRuns: number;
  completedRuns: number;
  retouchUsageRate: number;
  avgRating: number | null;
  ratedCount: number;
  computedAt: string;
}

interface StageRow {
  id: string;
  run_id: string;
  stage: string;
}

interface VariantRow {
  id: string;
  stage_id: string;
  content_json: Record<string, unknown>;
  selected: boolean;
}

interface RunRow {
  id: string;
  campaign_id: string;
  status: string;
  completed_at: string | null;
  rating: number | null;
}

const RETOUCH_CATEGORIES: Record<string, string[]> = {
  size: ["크게", "작게", "크기", "확대", "축소"],
  position: ["위로", "아래로", "좌측", "우측", "중앙", "가운데", "위치"],
  color: ["어둡", "밝", "대비", "색", "톤"],
  text: ["텍스트", "카피", "헤드라인", "문구", "글자", "서브"],
  cta: ["cta", "버튼"],
  background: ["배경"],
  number: ["숫자", "수치", "%"],
  margin: ["여백", "공간"],
  logo: ["로고"],
  remove: ["제거", "삭제", "없애"],
  add: ["추가"],
};

function categorizeRetouch(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const [cat, keywords] of Object.entries(RETOUCH_CATEGORIES)) {
    if (keywords.some((kw) => lower.includes(kw))) matches.push(cat);
  }
  return matches;
}

function inc(map: Record<string, number>, key: string | undefined | null): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

export async function aggregatePreferences(
  brandId: string,
): Promise<PreferenceAggregation> {
  const supabase = createAdminClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", brandId);
  const campaignIds = (campaigns ?? []).map((c: { id: string }) => c.id);

  const empty: PreferenceAggregation = {
    hookCounts: {},
    frameworkCounts: {},
    roleCounts: {},
    focusCounts: {},
    logoPositionCounts: {},
    retouchCategoryCounts: {},
    retouchTurnsTotal: 0,
    retouchTurnsPerRun: 0,
    totalRuns: 0,
    completedRuns: 0,
    retouchUsageRate: 0,
    avgRating: null,
    ratedCount: 0,
    computedAt: new Date().toISOString(),
  };
  if (campaignIds.length === 0) return empty;

  const { data: runs } = await supabase
    .from("creative_runs")
    .select("id, campaign_id, status, completed_at, rating")
    .in("campaign_id", campaignIds);
  const runRows = (runs ?? []) as RunRow[];
  const runIds = runRows.map((r) => r.id);
  if (runIds.length === 0) return empty;

  const { data: stages } = await supabase
    .from("creative_stages")
    .select("id, run_id, stage")
    .in("run_id", runIds);
  const stageRows = (stages ?? []) as StageRow[];
  const stageMap = new Map(stageRows.map((s) => [s.id, s.stage]));
  const stageIds = stageRows.map((s) => s.id);
  if (stageIds.length === 0) return { ...empty, totalRuns: runRows.length };

  const { data: variants } = await supabase
    .from("creative_variants")
    .select("id, stage_id, content_json, selected")
    .in("stage_id", stageIds);
  const variantRows = (variants ?? []) as VariantRow[];

  const hookCounts: Record<string, number> = {};
  const frameworkCounts: Record<string, number> = {};
  const roleCounts: Record<string, number> = {};
  const focusCounts: Record<string, number> = {};
  const logoPositionCounts: Record<string, number> = {};
  const retouchCategoryCounts: Record<string, number> = {};

  for (const v of variantRows) {
    const stage = stageMap.get(v.stage_id);
    const c = v.content_json ?? {};
    if (stage === "retouch") {
      const instruction = (c.instruction as string | undefined) ?? "";
      if (instruction) {
        for (const cat of categorizeRetouch(instruction)) {
          inc(retouchCategoryCounts, cat);
        }
      }
    }
    if (!v.selected) continue;
    if (stage === "strategy") {
      inc(hookCounts, c.hookType as string | undefined);
      inc(frameworkCounts, c.frameworkId as string | undefined);
      inc(roleCounts, c.role as string | undefined);
    } else if (stage === "visual") {
      inc(focusCounts, c.focus as string | undefined);
    } else if (stage === "compose") {
      const pos = c.logoPosition as string | undefined;
      const xRatio = c.logoXRatio as number | undefined;
      if (pos) inc(logoPositionCounts, pos);
      else if (xRatio != null) inc(logoPositionCounts, "custom");
    }
  }

  const retouchStageIds = stageRows.filter((s) => s.stage === "retouch").map((s) => s.id);
  const retouchTurnsTotal = variantRows.filter((v) =>
    retouchStageIds.includes(v.stage_id),
  ).length;
  const retouchRunCount = new Set(
    stageRows.filter((s) => s.stage === "retouch").map((s) => s.run_id),
  ).size;
  const completedRuns = runRows.filter((r) => r.status === "complete").length;
  const retouchUsageRate =
    runRows.length > 0 ? retouchRunCount / runRows.length : 0;

  const ratedRuns = runRows.filter((r) => r.rating != null);
  const avgRating =
    ratedRuns.length > 0
      ? ratedRuns.reduce((a, b) => a + (b.rating ?? 0), 0) / ratedRuns.length
      : null;

  return {
    hookCounts,
    frameworkCounts,
    roleCounts,
    focusCounts,
    logoPositionCounts,
    retouchCategoryCounts,
    retouchTurnsTotal,
    retouchTurnsPerRun:
      retouchRunCount > 0 ? retouchTurnsTotal / retouchRunCount : 0,
    totalRuns: runRows.length,
    completedRuns,
    retouchUsageRate,
    avgRating,
    ratedCount: ratedRuns.length,
    computedAt: new Date().toISOString(),
  };
}

export async function saveLearnings(
  brandId: string,
  agg: PreferenceAggregation,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("brand_learnings").upsert(
    {
      brand_id: brandId,
      hook_win_rates_json: agg.hookCounts,
      framework_win_rates_json: agg.frameworkCounts,
      visual_patterns_json: {
        focusCounts: agg.focusCounts,
        logoPositionCounts: agg.logoPositionCounts,
        retouchCategoryCounts: agg.retouchCategoryCounts,
        roleCounts: agg.roleCounts,
        retouchTurnsTotal: agg.retouchTurnsTotal,
        retouchTurnsPerRun: agg.retouchTurnsPerRun,
        retouchUsageRate: agg.retouchUsageRate,
        completedRuns: agg.completedRuns,
        totalRuns: agg.totalRuns,
        avgRating: agg.avgRating,
        ratedCount: agg.ratedCount,
      },
      computed_at: agg.computedAt,
    },
    { onConflict: "brand_id" },
  );
  if (error) throw error;
}

export async function recomputeLearnings(
  brandId: string,
): Promise<PreferenceAggregation> {
  const agg = await aggregatePreferences(brandId);
  await saveLearnings(brandId, agg);
  return agg;
}

export function topN(
  counts: Record<string, number>,
  n: number = 3,
): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}
