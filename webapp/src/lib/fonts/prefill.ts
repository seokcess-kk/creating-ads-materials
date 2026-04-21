import type { BrandIdentity, BrandReference, FontRole } from "@/lib/memory/types";
import { listFontPairs, upsertFontPair } from "@/lib/memory/fonts";
import { findFont } from "./queries";
import { getPresetById, TONE_PRESETS, type TonePreset, type TonePresetId } from "./tone-pairs";

export interface PrefillSignals {
  voiceTone?: string | null;
  personality?: string[] | null;
  category?: string | null;
  references?: BrandReference[] | null;
}

// 키워드 → 프리셋 매핑. 앞선 규칙이 우선.
const TONE_KEYWORD_RULES: Array<{ preset: TonePresetId; keywords: string[] }> = [
  {
    preset: "premium_trust",
    keywords: [
      "프리미엄", "신뢰", "전문", "고급", "정직", "안정",
      "premium", "trust", "professional", "authoritative",
    ],
  },
  {
    preset: "impact_event",
    keywords: [
      "강렬", "임팩트", "역동", "이벤트", "파워", "공격",
      "impact", "bold", "loud", "energetic",
    ],
  },
  {
    preset: "shopping_promo",
    keywords: [
      "쇼핑", "세일", "할인", "프로모션", "특가", "혜택",
      "sale", "promo", "discount", "deal",
    ],
  },
  {
    preset: "casual_friendly",
    keywords: [
      "친근", "캐주얼", "따뜻", "편안", "정겨운", "귀여",
      "friendly", "casual", "warm", "approachable", "cute",
    ],
  },
  {
    preset: "emotional_story",
    keywords: [
      "감성", "스토리", "우아", "세련", "로맨틱", "여성",
      "엘레강스", "부드러",
      "emotional", "elegant", "romantic", "storytelling", "refined",
    ],
  },
  {
    preset: "minimal_tech",
    keywords: [
      "미니멀", "심플", "테크", "모던", "깔끔", "정제",
      "minimal", "simple", "modern", "clean", "tech", "sleek",
    ],
  },
];

// BP vision typography.style → preset 힌트
const TYPOGRAPHY_RULES: Array<{ preset: TonePresetId; patterns: string[] }> = [
  { preset: "emotional_story", patterns: ["serif", "명조", "elegant", "romantic"] },
  { preset: "impact_event", patterns: ["display", "impact", "bold", "heavy"] },
  { preset: "minimal_tech", patterns: ["geometric", "minimal", "sans", "modern"] },
  { preset: "casual_friendly", patterns: ["rounded", "handwritten", "friendly"] },
];

function matchByKeyword(text: string): TonePresetId | null {
  const t = text.toLowerCase();
  for (const rule of TONE_KEYWORD_RULES) {
    if (rule.keywords.some((k) => t.includes(k.toLowerCase()))) return rule.preset;
  }
  return null;
}

function matchByIndustryCategory(category: string): TonePresetId | null {
  const normalized = category.toLowerCase();
  for (const preset of TONE_PRESETS) {
    if (
      preset.matchIndustries.some(
        (i) => normalized.includes(i) || i.includes(normalized),
      )
    ) {
      return preset.id;
    }
  }
  return null;
}

function matchByBPTypography(references: BrandReference[]): TonePresetId | null {
  const ready = references.filter(
    (r) => r.vision_status === "ready" && !r.is_negative,
  );
  if (ready.length === 0) return null;
  // weighted tally over typography.style + typography.letterSpacing 기타 힌트
  const scores: Record<TonePresetId, number> = {
    premium_trust: 0,
    shopping_promo: 0,
    casual_friendly: 0,
    emotional_story: 0,
    minimal_tech: 0,
    impact_event: 0,
  };
  for (const r of ready) {
    const w = Math.max(0, r.weight ?? 50) / 50;
    if (w <= 0) continue;
    const style = r.vision_analysis_json?.typography?.style;
    if (!style) continue;
    const lower = style.toLowerCase();
    for (const rule of TYPOGRAPHY_RULES) {
      if (rule.patterns.some((p) => lower.includes(p))) {
        scores[rule.preset] += w;
      }
    }
  }
  const entries = Object.entries(scores) as Array<[TonePresetId, number]>;
  const [top, topScore] = entries.reduce(
    (best, cur) => (cur[1] > best[1] ? cur : best),
    entries[0],
  );
  return topScore > 0 ? top : null;
}

export interface ResolveResult {
  presetId: TonePresetId | null;
  source: "bp_typography" | "voice_tone" | "category" | null;
}

export function resolvePresetFromSignals(signals: PrefillSignals): ResolveResult {
  // 1) BP가 있으면 데이터 기반 신호 우선
  if (signals.references && signals.references.length > 0) {
    const byBP = matchByBPTypography(signals.references);
    if (byBP) return { presetId: byBP, source: "bp_typography" };
  }
  // 2) voice.tone + personality 키워드
  const combined = [signals.voiceTone ?? "", ...(signals.personality ?? [])]
    .filter(Boolean)
    .join(" ");
  if (combined.trim()) {
    const byTone = matchByKeyword(combined);
    if (byTone) return { presetId: byTone, source: "voice_tone" };
  }
  // 3) category/industry fallback
  if (signals.category) {
    const byCat = matchByIndustryCategory(signals.category);
    if (byCat) return { presetId: byCat, source: "category" };
  }
  return { presetId: null, source: null };
}

export interface PrefillResult {
  skipped: boolean;
  reason?: "has_existing_pairs" | "no_preset_resolved";
  presetId?: TonePresetId;
  source?: ResolveResult["source"];
  filled: Array<{ role: FontRole; fontId: string; family: string; weight: string }>;
  missing: Array<{ role: FontRole; family: string; weight: string }>;
}

export async function prefillFontPairs(
  brandId: string,
  signals: PrefillSignals,
  options: { force?: boolean } = {},
): Promise<PrefillResult> {
  const existing = await listFontPairs(brandId);
  if (!options.force && existing.length > 0) {
    return { skipped: true, reason: "has_existing_pairs", filled: [], missing: [] };
  }

  const { presetId, source } = resolvePresetFromSignals(signals);
  if (!presetId) {
    return { skipped: true, reason: "no_preset_resolved", filled: [], missing: [] };
  }

  const preset = getPresetById(presetId) as TonePreset;
  const filled: PrefillResult["filled"] = [];
  const missing: PrefillResult["missing"] = [];

  for (const [role, spec] of Object.entries(preset.roles) as Array<
    [FontRole, { family: string; weight: string }]
  >) {
    const font = await findFont(spec.family, spec.weight);
    if (!font) {
      missing.push({ role, family: spec.family, weight: spec.weight });
      continue;
    }
    await upsertFontPair(brandId, role, font.id);
    filled.push({
      role,
      fontId: font.id,
      family: font.family,
      weight: font.weight ?? spec.weight,
    });
  }

  return { skipped: false, presetId, source, filled, missing };
}

export function collectSignalsForPrefill(params: {
  category?: string | null;
  identity?: BrandIdentity | null;
  references?: BrandReference[] | null;
}): PrefillSignals {
  const voice = params.identity?.voice_json as
    | { tone?: string; personality?: string[] }
    | undefined;
  return {
    voiceTone: voice?.tone ?? null,
    personality: voice?.personality ?? null,
    category: params.category ?? null,
    references: params.references ?? null,
  };
}
