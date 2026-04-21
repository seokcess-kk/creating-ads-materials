import type { BrandMemory } from "@/lib/memory/types";
import { topN } from "./aggregate-preferences";

interface VisualPatternsShape {
  focusCounts?: Record<string, number>;
  logoPositionCounts?: Record<string, number>;
  retouchCategoryCounts?: Record<string, number>;
  retouchUsageRate?: number;
  retouchTurnsPerRun?: number;
  completedRuns?: number;
  totalRuns?: number;
  avgRating?: number | null;
  ratedCount?: number;
}

export function buildPreferenceDigest(memory: BrandMemory): string {
  const learnings = memory.learnings;
  if (!learnings) return "(학습 데이터 없음 — 기본 플레이북으로 진행)";

  const hookRates = (learnings.hook_win_rates_json ?? {}) as Record<string, number>;
  const fwRates = (learnings.framework_win_rates_json ?? {}) as Record<string, number>;
  const patterns = (learnings.visual_patterns_json ?? {}) as VisualPatternsShape;

  const topHooks = topN(hookRates, 3);
  const topFws = topN(fwRates, 3);
  const topFocus = patterns.focusCounts ? topN(patterns.focusCounts, 3) : [];
  const retouchCategories = patterns.retouchCategoryCounts
    ? topN(patterns.retouchCategoryCounts, 5)
    : [];

  const completed = patterns.completedRuns ?? 0;
  if (
    completed === 0 &&
    topHooks.length === 0 &&
    topFws.length === 0 &&
    retouchCategories.length === 0
  ) {
    return "(첫 캠페인 — 플레이북·BP 패턴 기반으로 진행)";
  }

  const lines: string[] = [];
  lines.push(`- 완료 캠페인: ${completed}개 (전체 ${patterns.totalRuns ?? 0})`);
  if (topHooks.length) {
    lines.push(
      `- 선호 훅: ${topHooks.map((h) => `${h.key}(×${h.count})`).join(", ")}`,
    );
  }
  if (topFws.length) {
    lines.push(
      `- 선호 프레임워크: ${topFws.map((f) => `${f.key}(×${f.count})`).join(", ")}`,
    );
  }
  if (topFocus.length) {
    lines.push(
      `- 선호 비주얼 포커스: ${topFocus.map((f) => `${f.key}(×${f.count})`).join(", ")}`,
    );
  }
  if (retouchCategories.length) {
    lines.push(
      `- 자주 수정한 영역(주의): ${retouchCategories
        .map((r) => `${r.key}(×${r.count})`)
        .join(", ")}`,
    );
  }
  if (patterns.retouchUsageRate != null && patterns.retouchUsageRate > 0) {
    lines.push(
      `- Retouch 사용률: ${(patterns.retouchUsageRate * 100).toFixed(0)}% · 평균 ${
        patterns.retouchTurnsPerRun?.toFixed(1) ?? "?"
      } 턴`,
    );
  }
  if (patterns.avgRating != null && patterns.ratedCount != null && patterns.ratedCount > 0) {
    lines.push(
      `- 평균 주관 평점: ${patterns.avgRating.toFixed(1)}/5 (${patterns.ratedCount}개)`,
    );
  }
  return lines.join("\n");
}

export function hasPreferenceSignal(memory: BrandMemory): boolean {
  const learnings = memory.learnings;
  if (!learnings) return false;
  const hook = learnings.hook_win_rates_json as Record<string, number> | undefined;
  const fw = learnings.framework_win_rates_json as Record<string, number> | undefined;
  const hookCount = hook ? Object.keys(hook).length : 0;
  const fwCount = fw ? Object.keys(fw).length : 0;
  return hookCount > 0 || fwCount > 0;
}
