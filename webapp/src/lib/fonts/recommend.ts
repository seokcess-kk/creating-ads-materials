import type { BrandFontPair, FontRole, FontRow } from "@/lib/memory/types";
import { findPresetByIndustry, getPresetById, TONE_PRESETS, type TonePresetId } from "./tone-pairs";
import { findFont, listFonts } from "./queries";

export interface RecommendedFontSet {
  presetId: TonePresetId;
  presetLabel: string;
  pairs: Array<{
    role: FontRole;
    font: FontRow | null;
    fallbackFamily: string;
    fallbackWeight: string;
  }>;
  missing: Array<{ role: FontRole; family: string; weight: string }>;
}

const ROLES: FontRole[] = ["headline", "sub", "cta", "brand", "slogan"];

export async function recommendFromPreset(presetId: TonePresetId): Promise<RecommendedFontSet> {
  const preset = getPresetById(presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);

  const pairs: RecommendedFontSet["pairs"] = [];
  const missing: RecommendedFontSet["missing"] = [];

  for (const role of ROLES) {
    const spec = preset.roles[role];
    const font = await findFont(spec.family, spec.weight);
    pairs.push({
      role,
      font,
      fallbackFamily: spec.family,
      fallbackWeight: spec.weight,
    });
    if (!font) missing.push({ role, family: spec.family, weight: spec.weight });
  }

  return {
    presetId: preset.id,
    presetLabel: preset.label,
    pairs,
    missing,
  };
}

export async function recommendFromIndustry(
  industry: string | null | undefined,
): Promise<RecommendedFontSet | null> {
  const preset = findPresetByIndustry(industry);
  if (!preset) return null;
  return recommendFromPreset(preset.id);
}

export async function recommendTopPresets(limit: number = 3): Promise<TonePresetId[]> {
  return TONE_PRESETS.slice(0, limit).map((p) => p.id);
}

export function pairsToMap(pairs: BrandFontPair[]): Partial<Record<FontRole, BrandFontPair>> {
  const map: Partial<Record<FontRole, BrandFontPair>> = {};
  for (const p of pairs) map[p.role as FontRole] = p;
  return map;
}

export async function listAvailableByRole(role: FontRole, limit: number = 30): Promise<FontRow[]> {
  const fonts = await listFonts({ limit: limit * 3 });
  return fonts
    .filter(
      (f) =>
        f.recommended_roles.includes(role) ||
        (role === "headline" && f.category === "impact_display") ||
        (role === "sub" && f.category === "premium_sans"),
    )
    .slice(0, limit);
}
