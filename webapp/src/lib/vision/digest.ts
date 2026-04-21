import type { BrandMemory, BrandReference } from "@/lib/memory/types";

function readyRefs(memory: BrandMemory): BrandReference[] {
  return memory.references.filter((r) => r.vision_status === "ready");
}

export function buildVisionDigest(memory: BrandMemory, maxRefs: number = 5): string {
  const ready = readyRefs(memory);
  if (ready.length === 0) return "(없음)";
  return ready
    .slice(0, maxRefs)
    .map((r, i) => {
      const a = r.vision_analysis_json;
      const parts: string[] = [];
      if (a.copyStructure?.hookType) parts.push(`hook=${a.copyStructure.hookType}`);
      if (a.copyStructure?.framework) parts.push(`framework=${a.copyStructure.framework}`);
      if (a.hookElement?.type) parts.push(`hookElement=${a.hookElement.type}`);
      if (a.color?.mood) parts.push(`mood=${a.color.mood}`);
      const bofuFit = a.funnelFit?.BOFU;
      if (bofuFit !== undefined) parts.push(`bofuFit=${bofuFit.toFixed(2)}`);
      return `  BP#${i + 1} (w=${r.weight}${r.is_negative ? ", NEG" : ""}): ${parts.join(", ")}`;
    })
    .join("\n");
}

export function buildCopyPatternDigest(memory: BrandMemory, maxRefs: number = 5): string {
  const ready = readyRefs(memory).filter((r) => !r.is_negative);
  if (ready.length === 0) return "(없음)";

  const hookCounts: Record<string, number> = {};
  const frameworkCounts: Record<string, number> = {};
  const headlineLens: number[] = [];
  for (const r of ready) {
    const a = r.vision_analysis_json;
    if (a.copyStructure?.hookType) {
      hookCounts[a.copyStructure.hookType] = (hookCounts[a.copyStructure.hookType] ?? 0) + 1;
    }
    if (a.copyStructure?.framework) {
      frameworkCounts[a.copyStructure.framework] =
        (frameworkCounts[a.copyStructure.framework] ?? 0) + 1;
    }
    if (a.copyStructure?.headlineLen) headlineLens.push(a.copyStructure.headlineLen);
  }
  const topHook =
    Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(없음)";
  const topFw =
    Object.entries(frameworkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(없음)";
  const avgHeadLen = headlineLens.length
    ? Math.round(headlineLens.reduce((a, b) => a + b, 0) / headlineLens.length)
    : null;

  const lines = [
    `- 자주 쓰인 hook: ${topHook} (카운트: ${Object.entries(hookCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "없음"})`,
    `- 자주 쓰인 framework: ${topFw} (${Object.entries(frameworkCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "없음"})`,
  ];
  if (avgHeadLen) lines.push(`- 헤드라인 평균 길이: 약 ${avgHeadLen}자`);
  const negativeHooks = readyRefs(memory).filter((r) => r.is_negative).length;
  if (negativeHooks > 0) {
    lines.push(`- Negative 샘플 ${negativeHooks}개 — 상기 패턴과 반대로 가지 말 것`);
  }
  return lines.join("\n");
}

export interface VisualPatternSummary {
  palette: string[];
  topMoods: string[];
  topLayoutZone: string | null;
  avgMarginRatio: number | null;
  topTypography: string | null;
  topHookElement: string | null;
  topLogoPosition: string | null;
  topCtaStyle: string | null;
  avgLogoSizeRatio: number | null;
}

export function summarizeVisualPatterns(memory: BrandMemory): VisualPatternSummary {
  const ready = readyRefs(memory).filter((r) => !r.is_negative);
  const paletteSet = new Set<string>();
  const moodCounts: Record<string, number> = {};
  const zoneCounts: Record<string, number> = {};
  const typographyCounts: Record<string, number> = {};
  const hookElementCounts: Record<string, number> = {};
  const logoPosCounts: Record<string, number> = {};
  const ctaStyleCounts: Record<string, number> = {};
  const marginRatios: number[] = [];
  const logoSizeRatios: number[] = [];

  for (const r of ready) {
    const a = r.vision_analysis_json;
    a.color?.palette?.forEach((h) => paletteSet.add(h.toUpperCase()));
    if (a.color?.mood) moodCounts[a.color.mood] = (moodCounts[a.color.mood] ?? 0) + 1;
    if (a.layout?.textZone)
      zoneCounts[a.layout.textZone] = (zoneCounts[a.layout.textZone] ?? 0) + 1;
    if (a.layout?.marginRatio != null) marginRatios.push(a.layout.marginRatio);
    if (a.typography?.style)
      typographyCounts[a.typography.style] = (typographyCounts[a.typography.style] ?? 0) + 1;
    if (a.hookElement?.type)
      hookElementCounts[a.hookElement.type] =
        (hookElementCounts[a.hookElement.type] ?? 0) + 1;
    if (a.brandElements?.logoPosition)
      logoPosCounts[a.brandElements.logoPosition] =
        (logoPosCounts[a.brandElements.logoPosition] ?? 0) + 1;
    if (a.brandElements?.ctaStyle)
      ctaStyleCounts[a.brandElements.ctaStyle] =
        (ctaStyleCounts[a.brandElements.ctaStyle] ?? 0) + 1;
    if (a.brandElements?.logoSizeRatio != null)
      logoSizeRatios.push(a.brandElements.logoSizeRatio);
  }

  const top = (m: Record<string, number>): string | null =>
    Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    palette: Array.from(paletteSet).slice(0, 6),
    topMoods: Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k),
    topLayoutZone: top(zoneCounts),
    avgMarginRatio: marginRatios.length
      ? marginRatios.reduce((a, b) => a + b, 0) / marginRatios.length
      : null,
    topTypography: top(typographyCounts),
    topHookElement: top(hookElementCounts),
    topLogoPosition: top(logoPosCounts),
    topCtaStyle: top(ctaStyleCounts),
    avgLogoSizeRatio: logoSizeRatios.length
      ? logoSizeRatios.reduce((a, b) => a + b, 0) / logoSizeRatios.length
      : null,
  };
}

export function buildVisualPatternDigestEn(memory: BrandMemory): string {
  const s = summarizeVisualPatterns(memory);
  if (
    s.palette.length === 0 &&
    s.topMoods.length === 0 &&
    !s.topLayoutZone &&
    !s.topTypography &&
    !s.topHookElement
  ) {
    return "(no BP patterns available)";
  }
  const lines: string[] = [];
  if (s.palette.length) lines.push(`- Common palette (past winners): ${s.palette.join(", ")}`);
  if (s.topMoods.length) lines.push(`- Mood tendencies: ${s.topMoods.join(", ")}`);
  if (s.topLayoutZone) lines.push(`- Preferred text zone: ${s.topLayoutZone}`);
  if (s.avgMarginRatio != null)
    lines.push(`- Avg margin ratio: ${(s.avgMarginRatio * 100).toFixed(0)}%`);
  if (s.topTypography) lines.push(`- Typography style: ${s.topTypography}`);
  if (s.topHookElement) lines.push(`- Frequent hook element: ${s.topHookElement}`);
  if (s.topLogoPosition) lines.push(`- Logo position: ${s.topLogoPosition}`);
  if (s.topCtaStyle) lines.push(`- CTA style: ${s.topCtaStyle}`);
  if (s.avgLogoSizeRatio != null)
    lines.push(`- Logo size ratio: ~${(s.avgLogoSizeRatio * 100).toFixed(1)}% of frame`);
  const negCount = readyRefs(memory).filter((r) => r.is_negative).length;
  if (negCount > 0) lines.push(`- ${negCount} negative sample(s) — avoid their style`);
  return lines.join("\n");
}
