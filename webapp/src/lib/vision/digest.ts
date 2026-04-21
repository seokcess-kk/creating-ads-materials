import type { BrandMemory, BrandReference } from "@/lib/memory/types";

function readyRefs(memory: BrandMemory): BrandReference[] {
  return memory.references.filter((r) => r.vision_status === "ready");
}

// weight=50이 기본(1.0x). 100이면 2.0x, 0이면 집계에서 실질 제외.
function refWeight(r: BrandReference): number {
  return Math.max(0, r.weight ?? 50) / 50;
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

  const hookScores: Record<string, number> = {};
  const frameworkScores: Record<string, number> = {};
  let headlineLenWSum = 0;
  let headlineLenW = 0;
  for (const r of ready) {
    const w = refWeight(r);
    if (w <= 0) continue;
    const a = r.vision_analysis_json;
    if (a.copyStructure?.hookType) {
      hookScores[a.copyStructure.hookType] =
        (hookScores[a.copyStructure.hookType] ?? 0) + w;
    }
    if (a.copyStructure?.framework) {
      frameworkScores[a.copyStructure.framework] =
        (frameworkScores[a.copyStructure.framework] ?? 0) + w;
    }
    if (a.copyStructure?.headlineLen) {
      headlineLenWSum += a.copyStructure.headlineLen * w;
      headlineLenW += w;
    }
  }
  const fmt = (m: Record<string, number>): string =>
    Object.entries(m)
      .map(([k, v]) => `${k}=${v.toFixed(1)}`)
      .join(", ") || "없음";
  const topHook =
    Object.entries(hookScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(없음)";
  const topFw =
    Object.entries(frameworkScores).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "(없음)";
  const avgHeadLen =
    headlineLenW > 0 ? Math.round(headlineLenWSum / headlineLenW) : null;

  const lines = [
    `- 자주 쓰인 hook: ${topHook} (가중치합: ${fmt(hookScores)})`,
    `- 자주 쓰인 framework: ${topFw} (${fmt(frameworkScores)})`,
  ];
  if (avgHeadLen)
    lines.push(`- 헤드라인 평균 길이: 약 ${avgHeadLen}자 (가중평균)`);
  const negativeHooks = readyRefs(memory).filter((r) => r.is_negative).length;
  if (negativeHooks > 0) {
    lines.push(`- Negative 샘플 ${negativeHooks}개 — 상기 패턴과 반대로 가지 말 것`);
  }
  // maxRefs는 인터페이스 호환 유지용 (집계는 전체 사용)
  void maxRefs;
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
  const paletteScores = new Map<string, number>();
  const moodScores: Record<string, number> = {};
  const zoneScores: Record<string, number> = {};
  const typographyScores: Record<string, number> = {};
  const hookElementScores: Record<string, number> = {};
  const logoPosScores: Record<string, number> = {};
  const ctaStyleScores: Record<string, number> = {};
  let marginSum = 0;
  let marginW = 0;
  let logoSizeSum = 0;
  let logoSizeW = 0;

  for (const r of ready) {
    const w = refWeight(r);
    if (w <= 0) continue;
    const a = r.vision_analysis_json;
    a.color?.palette?.forEach((h) => {
      const key = h.toUpperCase();
      paletteScores.set(key, (paletteScores.get(key) ?? 0) + w);
    });
    if (a.color?.mood)
      moodScores[a.color.mood] = (moodScores[a.color.mood] ?? 0) + w;
    if (a.layout?.textZone)
      zoneScores[a.layout.textZone] = (zoneScores[a.layout.textZone] ?? 0) + w;
    if (a.layout?.marginRatio != null) {
      marginSum += a.layout.marginRatio * w;
      marginW += w;
    }
    if (a.typography?.style)
      typographyScores[a.typography.style] =
        (typographyScores[a.typography.style] ?? 0) + w;
    if (a.hookElement?.type)
      hookElementScores[a.hookElement.type] =
        (hookElementScores[a.hookElement.type] ?? 0) + w;
    if (a.brandElements?.logoPosition)
      logoPosScores[a.brandElements.logoPosition] =
        (logoPosScores[a.brandElements.logoPosition] ?? 0) + w;
    if (a.brandElements?.ctaStyle)
      ctaStyleScores[a.brandElements.ctaStyle] =
        (ctaStyleScores[a.brandElements.ctaStyle] ?? 0) + w;
    if (a.brandElements?.logoSizeRatio != null) {
      logoSizeSum += a.brandElements.logoSizeRatio * w;
      logoSizeW += w;
    }
  }

  const top = (m: Record<string, number>): string | null =>
    Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    palette: Array.from(paletteScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k),
    topMoods: Object.entries(moodScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k),
    topLayoutZone: top(zoneScores),
    avgMarginRatio: marginW > 0 ? marginSum / marginW : null,
    topTypography: top(typographyScores),
    topHookElement: top(hookElementScores),
    topLogoPosition: top(logoPosScores),
    topCtaStyle: top(ctaStyleScores),
    avgLogoSizeRatio: logoSizeW > 0 ? logoSizeSum / logoSizeW : null,
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
