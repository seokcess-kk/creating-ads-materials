import type { FontRole, FontRow } from "@/lib/memory/types";
import { findFont, listFonts } from "./queries";
import type { TonePreset, TonePresetId } from "./tone-pairs";

// 프리셋 정체성과 비슷한 tone_tag (DB에 없는 패밀리 대체 탐색용)
const PRESET_FALLBACK_TAGS: Record<TonePresetId, string[]> = {
  premium_trust: ["premium", "modern", "clean", "neutral", "stable", "readable"],
  shopping_promo: ["bold", "impact", "display", "loud", "punchy"],
  casual_friendly: ["friendly", "soft", "rounded", "lifestyle", "fnb"],
  emotional_story: ["elegant", "refined", "serif", "classic", "romantic"],
  minimal_tech: ["modern", "clean", "tech", "startup", "technical", "neutral"],
  impact_event: ["bold", "impact", "display", "heavy", "loud"],
};

// role별 선호 weight (fallback 순서)
const ROLE_WEIGHT_PREFERENCE: Record<FontRole, string[]> = {
  headline: ["ExtraBold", "Bold", "SemiBold", "Medium", "Regular"],
  sub: ["Regular", "Medium", "Light"],
  cta: ["Bold", "SemiBold", "Medium"],
  brand: ["SemiBold", "Bold", "Medium"],
  slogan: ["Light", "Regular", "Medium"],
};

export type ResolveSource =
  | "exact"
  | "same_family"
  | "semantic"
  | "role_fallback";

export interface ResolvedFont {
  font: FontRow;
  source: ResolveSource;
  requested: { family: string; weight: string };
}

/**
 * 프리셋 role의 목표 폰트를 DB 가용 폰트에서 해석.
 * 우선순위:
 *   1. 정확히 동일 family+weight
 *   2. 동일 family, 다른 weight
 *   3. 프리셋 정체성과 tone_tag 겹치고 role에 추천되는 폰트
 *   4. role에 추천되는 아무 폰트 (weight 선호 순)
 * 모두 실패하면 null.
 */
export async function resolveFontForPresetRole(
  preset: TonePreset,
  role: FontRole,
): Promise<ResolvedFont | null> {
  const spec = preset.roles[role];
  const requested = { family: spec.family, weight: spec.weight };

  // 1. Exact
  const exact = await findFont(spec.family, spec.weight);
  if (exact) return { font: exact, source: "exact", requested };

  // 2. Same family, 다른 weight
  const sameFamily = await findFont(spec.family, null);
  if (sameFamily) return { font: sameFamily, source: "same_family", requested };

  // 3. & 4. DB 전체를 한 번만 스캔해 후보 선정
  const candidates = await listFonts({ limit: 100 });
  const roleCandidates = candidates.filter((f) =>
    f.recommended_roles.includes(role),
  );
  if (roleCandidates.length === 0) return null;

  // Semantic: tone_tag 겹침 점수
  const fallbackTags = PRESET_FALLBACK_TAGS[preset.id] ?? [];
  const scored = roleCandidates.map((f) => ({
    font: f,
    tagScore: f.tone_tags.filter((t) => fallbackTags.includes(t)).length,
    weightRank: (() => {
      const prefs = ROLE_WEIGHT_PREFERENCE[role];
      const idx = f.weight ? prefs.indexOf(f.weight) : -1;
      return idx === -1 ? prefs.length : idx;
    })(),
  }));
  scored.sort((a, b) => {
    // tag 점수 높은 것 우선, 동점이면 선호 weight 순서 (낮은 rank)
    if (b.tagScore !== a.tagScore) return b.tagScore - a.tagScore;
    return a.weightRank - b.weightRank;
  });

  const top = scored[0];
  if (top.tagScore > 0) {
    return { font: top.font, source: "semantic", requested };
  }
  return { font: top.font, source: "role_fallback", requested };
}
