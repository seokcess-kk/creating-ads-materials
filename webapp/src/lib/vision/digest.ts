import type { BrandMemory, BrandReference } from "@/lib/memory/types";

export type FunnelGoal = "TOFU" | "MOFU" | "BOFU";

export interface DigestOpts {
  goal?: FunnelGoal;
  channel?: string;
}

function readyRefs(memory: BrandMemory): BrandReference[] {
  return memory.references.filter((r) => r.vision_status === "ready");
}

// 기본 weight (50=1.0x)
function baseWeight(r: BrandReference): number {
  return Math.max(0, r.weight ?? 50) / 50;
}

// Funnel·Channel 인지 실효 weight
// funnelFit[goal]이 있으면 곱함. 없으면 0.5(중립)로 간주해 강한 감점은 피함.
// channelFit[channel]이 있으면 추가 가중.
function effectiveWeight(r: BrandReference, opts?: DigestOpts): number {
  const base = baseWeight(r);
  if (!opts) return base;
  let w = base;
  if (opts.goal) {
    const fit = r.vision_analysis_json?.funnelFit?.[opts.goal];
    w *= fit != null ? fit : 0.5;
  }
  if (opts.channel) {
    const cf = r.vision_analysis_json?.channelFit?.[opts.channel];
    if (cf != null) w *= cf;
  }
  return w;
}

function sortedByEffectiveWeight(
  refs: BrandReference[],
  opts?: DigestOpts,
): BrandReference[] {
  return [...refs].sort(
    (a, b) => effectiveWeight(b, opts) - effectiveWeight(a, opts),
  );
}

/**
 * 개별 BP 카드 형태 digest (Strategy용).
 * funnel 인지 재가중으로 관련성 높은 BP를 앞쪽에 정렬.
 */
export function buildVisionDigest(
  memory: BrandMemory,
  opts?: DigestOpts,
  maxRefs: number = 5,
): string {
  const ready = readyRefs(memory);
  if (ready.length === 0) return "(없음)";
  const ordered = sortedByEffectiveWeight(ready, opts);
  return ordered
    .slice(0, maxRefs)
    .map((r, i) => {
      const a = r.vision_analysis_json;
      const parts: string[] = [];
      if (a.copyStructure?.hookType) parts.push(`hook=${a.copyStructure.hookType}`);
      if (a.copyStructure?.framework) parts.push(`framework=${a.copyStructure.framework}`);
      if (a.hookElement?.type) parts.push(`hookElement=${a.hookElement.type}`);
      if (a.color?.mood) parts.push(`mood=${a.color.mood}`);
      const goalFit = opts?.goal ? a.funnelFit?.[opts.goal] : undefined;
      if (goalFit !== undefined) parts.push(`${opts?.goal}Fit=${goalFit.toFixed(2)}`);
      const effW = effectiveWeight(r, opts);
      return `  BP#${i + 1} (w=${r.weight}${r.is_negative ? ", NEG" : ""}, eff=${effW.toFixed(2)}): ${parts.join(", ")}`;
    })
    .join("\n");
}

export function buildCopyPatternDigest(
  memory: BrandMemory,
  opts?: DigestOpts,
): string {
  const ready = readyRefs(memory).filter((r) => !r.is_negative);
  if (ready.length === 0) return "(없음)";

  const hookScores: Record<string, number> = {};
  const frameworkScores: Record<string, number> = {};
  let headlineLenWSum = 0;
  let headlineLenW = 0;
  for (const r of ready) {
    const w = effectiveWeight(r, opts);
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
  const topN = (m: Record<string, number>, n: number): Array<[string, number]> =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
  const fmtTop = (top: Array<[string, number]>): string =>
    top.map(([k, v]) => `${k}(${v.toFixed(1)})`).join(", ") || "없음";

  const topHooks = topN(hookScores, 3);
  const topFws = topN(frameworkScores, 3);
  const avgHeadLen =
    headlineLenW > 0 ? Math.round(headlineLenWSum / headlineLenW) : null;

  const lines = [
    `- 상위 hook (Top-3): ${fmtTop(topHooks)}`,
    `- 상위 framework (Top-3): ${fmtTop(topFws)}`,
  ];
  if (avgHeadLen) lines.push(`- 헤드라인 평균 길이: 약 ${avgHeadLen}자 (가중평균)`);
  const negativeHooks = readyRefs(memory).filter((r) => r.is_negative).length;
  if (negativeHooks > 0) {
    lines.push(`- Negative 샘플 ${negativeHooks}개 — 상기 패턴과 반대로 가지 말 것`);
  }
  if (opts?.goal) lines.push(`- (${opts.goal} 관련성으로 재가중)`);
  return lines.join("\n");
}

export interface VisualPatternSummary {
  palette: string[];
  topMoods: string[];
  topLayoutZone: string | null;
  topLayoutZones: string[];
  avgMarginRatio: number | null;
  topTypography: string | null;
  topTypographies: string[];
  topHookElement: string | null;
  topHookElements: string[];
  topLogoPosition: string | null;
  topCtaStyle: string | null;
  avgLogoSizeRatio: number | null;
}

export function summarizeVisualPatterns(
  memory: BrandMemory,
  opts?: DigestOpts,
): VisualPatternSummary {
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
    const w = effectiveWeight(r, opts);
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
  const topK = (m: Record<string, number>, k: number): string[] =>
    Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, k).map(([v]) => v);

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
    topLayoutZones: topK(zoneScores, 2),
    avgMarginRatio: marginW > 0 ? marginSum / marginW : null,
    topTypography: top(typographyScores),
    topTypographies: topK(typographyScores, 2),
    topHookElement: top(hookElementScores),
    topHookElements: topK(hookElementScores, 3),
    topLogoPosition: top(logoPosScores),
    topCtaStyle: top(ctaStyleScores),
    avgLogoSizeRatio: logoSizeW > 0 ? logoSizeSum / logoSizeW : null,
  };
}

export function buildVisualPatternDigestEn(
  memory: BrandMemory,
  opts?: DigestOpts,
): string {
  const s = summarizeVisualPatterns(memory, opts);
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
  if (s.palette.length) lines.push(`- Dominant palette: ${s.palette.join(", ")}`);
  if (s.topMoods.length) lines.push(`- Mood tendencies (top-${s.topMoods.length}): ${s.topMoods.join(", ")}`);
  if (s.topLayoutZones.length)
    lines.push(`- Preferred text zones: ${s.topLayoutZones.join(", ")}`);
  if (s.avgMarginRatio != null)
    lines.push(`- Avg margin ratio: ${(s.avgMarginRatio * 100).toFixed(0)}%`);
  if (s.topTypographies.length)
    lines.push(`- Typography styles: ${s.topTypographies.join(", ")}`);
  if (s.topHookElements.length)
    lines.push(`- Hook elements (vary across variants): ${s.topHookElements.join(", ")}`);
  if (s.topLogoPosition) lines.push(`- Logo position: ${s.topLogoPosition}`);
  if (s.topCtaStyle) lines.push(`- CTA style: ${s.topCtaStyle}`);
  if (s.avgLogoSizeRatio != null)
    lines.push(`- Logo size ratio: ~${(s.avgLogoSizeRatio * 100).toFixed(1)}% of frame`);
  const negCount = readyRefs(memory).filter((r) => r.is_negative).length;
  if (negCount > 0) lines.push(`- ${negCount} negative sample(s) — avoid their style`);
  if (opts?.goal) lines.push(`- (reweighted by ${opts.goal} funnel relevance)`);
  return lines.join("\n");
}

/**
 * Strategy 3대안(safe/explore/challenge)에 각각 어떤 BP 영역을 참고/탐색/반전할지
 * 구조화된 힌트 블록을 생성.
 * - safe: Top-1 조합을 재현
 * - explore: BP에 적게 등장한 영역 시도 (미등장 훅·대안 typography 등)
 * - challenge: Top-1의 반대 축
 */
export function buildStrategyRoleHints(
  memory: BrandMemory,
  opts?: DigestOpts,
): string {
  const s = summarizeVisualPatterns(memory, opts);
  const ready = readyRefs(memory).filter((r) => !r.is_negative);

  // hook / framework 분포 집계
  const hookScores: Record<string, number> = {};
  const fwScores: Record<string, number> = {};
  for (const r of ready) {
    const w = effectiveWeight(r, opts);
    if (w <= 0) continue;
    const h = r.vision_analysis_json.copyStructure?.hookType;
    const f = r.vision_analysis_json.copyStructure?.framework;
    if (h) hookScores[h] = (hookScores[h] ?? 0) + w;
    if (f) fwScores[f] = (fwScores[f] ?? 0) + w;
  }
  const topHook = Object.entries(hookScores).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topFw = Object.entries(fwScores).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (!topHook && !topFw && s.topMoods.length === 0) {
    return "(BP 데이터 부족 — role별 힌트는 플레이북 기반으로 자유 결정)";
  }

  // 훅 반대 축 매핑 (휴리스틱)
  const oppositeHook: Record<string, string> = {
    benefit: "problem",
    problem: "benefit",
    urgency: "insight",
    insight: "urgency",
    empathy: "number",
    number: "emotion",
    curiosity: "benefit",
    emotion: "number",
  };

  const allHooks = [
    "empathy",
    "problem",
    "insight",
    "emotion",
    "curiosity",
    "number",
    "benefit",
    "urgency",
  ];
  const underusedHooks = allHooks.filter(
    (h) => !(hookScores[h] > 0),
  );

  const lines: string[] = [];
  lines.push("- **safe**: BP 지배 패턴을 재현");
  const safeParts: string[] = [];
  if (topHook) safeParts.push(`hook=${topHook}`);
  if (topFw) safeParts.push(`framework=${topFw}`);
  if (s.topMoods[0]) safeParts.push(`mood=${s.topMoods[0]}`);
  if (s.topTypography) safeParts.push(`typography=${s.topTypography}`);
  lines.push(`    → ${safeParts.length ? safeParts.join(" · ") : "플레이북 기본"}`);

  lines.push("- **explore**: BP 미등장·저빈도 영역 탐색");
  const exploreParts: string[] = [];
  if (underusedHooks.length)
    exploreParts.push(`hook ∉ {${Object.keys(hookScores).join(", ") || "—"}} (시도: ${underusedHooks.slice(0, 3).join("/")})`);
  if (s.topTypographies[1])
    exploreParts.push(`typography=${s.topTypographies[1]} (2순위)`);
  else if (s.topTypography)
    exploreParts.push(`typography ≠ ${s.topTypography}`);
  if (s.topHookElements[1])
    exploreParts.push(`hookElement=${s.topHookElements[1]}`);
  lines.push(`    → ${exploreParts.length ? exploreParts.join(" · ") : "자유 탐색"}`);

  lines.push("- **challenge**: 지배 패턴의 반대 축으로 가설 검증");
  const challengeParts: string[] = [];
  if (topHook && oppositeHook[topHook])
    challengeParts.push(`hook=${oppositeHook[topHook]} (← ${topHook}의 반대)`);
  if (s.topMoods[0]) {
    const oppMood = /serious|formal|premium/i.test(s.topMoods[0])
      ? "playful/warm"
      : /warm|friendly|playful/i.test(s.topMoods[0])
        ? "serious/editorial"
        : `${s.topMoods[0]}의 대척점`;
    challengeParts.push(`mood=${oppMood}`);
  }
  if (s.topLayoutZone) {
    const oppZone =
      s.topLayoutZone === "top"
        ? "bottom"
        : s.topLayoutZone === "bottom"
          ? "top"
          : s.topLayoutZone === "center"
            ? "edge"
            : "center";
    challengeParts.push(`textZone=${oppZone}`);
  }
  lines.push(`    → ${challengeParts.length ? challengeParts.join(" · ") : "지배 패턴과 명확히 대비"}`);

  if (opts?.goal) lines.push(`  (${opts.goal} 관련성 재가중 적용)`);

  return lines.join("\n");
}
