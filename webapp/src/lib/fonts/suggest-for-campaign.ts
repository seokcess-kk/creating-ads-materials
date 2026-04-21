import type { BrandMemory } from "@/lib/memory/types";
import { summarizeVisualPatterns } from "@/lib/vision/digest";
import { TONE_PRESETS, type TonePresetId } from "./tone-pairs";
import { resolvePresetFromSignals, collectSignalsForPrefill } from "./prefill";

export interface FontSuggestion {
  presetId: TonePresetId;
  presetLabel: string;
  description: string;
  score: number;
  reasons: string[];
}

// BP의 집계 typography.style → preset 매칭 규칙
const TYPOGRAPHY_RULES: Array<{ preset: TonePresetId; patterns: string[]; weight: number }> = [
  { preset: "emotional_story", patterns: ["serif", "명조", "elegant", "romantic", "script"], weight: 3 },
  { preset: "impact_event", patterns: ["display", "impact", "bold", "heavy", "condensed"], weight: 3 },
  { preset: "minimal_tech", patterns: ["geometric", "minimal", "sans", "modern", "clean"], weight: 3 },
  { preset: "casual_friendly", patterns: ["rounded", "handwritten", "friendly", "chunky"], weight: 3 },
  { preset: "premium_trust", patterns: ["classic", "refined", "traditional"], weight: 2 },
];

// BP의 mood → preset 매칭
const MOOD_RULES: Array<{ preset: TonePresetId; moods: string[]; weight: number }> = [
  { preset: "impact_event", moods: ["vivid", "bold", "strong", "energetic"], weight: 2 },
  { preset: "minimal_tech", moods: ["calm", "clean", "neutral", "cool"], weight: 2 },
  { preset: "casual_friendly", moods: ["pastel", "warm", "soft", "bright"], weight: 2 },
  { preset: "emotional_story", moods: ["dark", "moody", "warm", "muted"], weight: 2 },
  { preset: "premium_trust", moods: ["premium", "luxe", "refined", "dark"], weight: 2 },
  { preset: "shopping_promo", moods: ["vivid", "loud", "bright", "punchy"], weight: 2 },
];

// CTA 스타일 → preset
const CTA_RULES: Array<{ preset: TonePresetId; patterns: string[]; weight: number }> = [
  { preset: "impact_event", patterns: ["solid", "block", "filled"], weight: 1 },
  { preset: "minimal_tech", patterns: ["outline", "ghost", "text-only"], weight: 1 },
  { preset: "casual_friendly", patterns: ["rounded", "pill"], weight: 1 },
];

// hookElement → preset
const HOOK_RULES: Array<{ preset: TonePresetId; patterns: string[]; weight: number }> = [
  { preset: "impact_event", patterns: ["sticker", "explosion", "shout"], weight: 1 },
  { preset: "shopping_promo", patterns: ["price", "discount", "badge"], weight: 1 },
  { preset: "emotional_story", patterns: ["quote", "illustration", "scene"], weight: 1 },
];

function scoreByRules<T extends { preset: TonePresetId; weight: number }>(
  rules: Array<T & { patterns?: string[]; moods?: string[] }>,
  value: string | null | undefined,
  scores: Record<TonePresetId, number>,
  reasons: Record<TonePresetId, string[]>,
  reasonLabel: string,
): void {
  if (!value) return;
  const v = value.toLowerCase();
  for (const rule of rules) {
    const hits = (rule.patterns ?? rule.moods ?? []).filter((p) =>
      v.includes(p.toLowerCase()),
    );
    if (hits.length > 0) {
      scores[rule.preset] += rule.weight;
      reasons[rule.preset].push(`${reasonLabel}: ${hits.join("·")}`);
    }
  }
}

function emptyScores(): Record<TonePresetId, number> {
  return {
    premium_trust: 0,
    shopping_promo: 0,
    casual_friendly: 0,
    emotional_story: 0,
    minimal_tech: 0,
    impact_event: 0,
  };
}

function emptyReasons(): Record<TonePresetId, string[]> {
  return {
    premium_trust: [],
    shopping_promo: [],
    casual_friendly: [],
    emotional_story: [],
    minimal_tech: [],
    impact_event: [],
  };
}

export interface SuggestInput {
  memory: BrandMemory;
  brandCategory?: string | null;
}

/**
 * 브랜드 BP 집계 패턴(+voice.tone·category)을 기반으로 6개 프리셋의 적합도 점수 계산.
 * 상위 3개를 이유와 함께 반환.
 */
export function suggestFontPresetsForCampaign(
  input: SuggestInput,
): FontSuggestion[] {
  const { memory, brandCategory } = input;
  const scores = emptyScores();
  const reasons = emptyReasons();

  const visualPattern = summarizeVisualPatterns(memory);

  // 1) BP typography.style — 가장 강한 신호
  scoreByRules(TYPOGRAPHY_RULES, visualPattern.topTypography, scores, reasons, "BP typography");

  // 2) BP mood (top 3 중 하나라도 매칭)
  for (const mood of visualPattern.topMoods) {
    scoreByRules(MOOD_RULES, mood, scores, reasons, "BP mood");
  }

  // 3) CTA 스타일
  scoreByRules(CTA_RULES, visualPattern.topCtaStyle, scores, reasons, "CTA style");

  // 4) Hook element
  scoreByRules(HOOK_RULES, visualPattern.topHookElement, scores, reasons, "hook element");

  // 5) voice.tone + category fallback — resolvePresetFromSignals 재사용하되 강도를 낮게
  const fallback = resolvePresetFromSignals(
    collectSignalsForPrefill({
      category: brandCategory,
      identity: memory.identity,
      references: memory.references,
    }),
  );
  if (fallback.presetId) {
    scores[fallback.presetId] += 1;
    const srcLabel = fallback.source === "voice_tone" ? "voice.tone" : fallback.source === "category" ? "카테고리" : "BP";
    reasons[fallback.presetId].push(`${srcLabel} 기반 기본 추천`);
  }

  // 점수 0인 프리셋에도 tie-breaker로 미세 점수 추가 (순서 결정용)
  // 현재 브랜드 기본 프리필과 같은 preset이면 기본 +0.5
  const baseline = fallback.presetId;
  if (baseline) scores[baseline] += 0.5;

  const ranked = TONE_PRESETS.map((p) => ({
    presetId: p.id,
    presetLabel: p.label,
    description: p.description,
    score: scores[p.id],
    reasons: reasons[p.id],
  })).sort((a, b) => b.score - a.score);

  // 최소 점수 0.5 이상 or 상위 3개 중에서도 의미 있는 것만 노출
  // 상위 3개 무조건 반환. 점수 0인 것도 포함해서 사용자가 전체 선택지 볼 수 있게.
  return ranked.slice(0, 3);
}
