import type { BrandFontPair, FontRole } from "@/lib/memory/types";
import { getFont } from "./queries";
import { TONE_PRESETS, type TonePresetId } from "./tone-pairs";

/**
 * 캠페인 폰트 오버라이드가 어떤 프리셋과 가장 일치하는지 추론.
 * 6개 프리셋 중 role별 family 일치 개수가 가장 많은 것을 반환.
 * 오버라이드가 없거나 매칭이 0이면 null.
 */
export async function inferPresetFromCampaignPairs(
  pairs: BrandFontPair[],
): Promise<TonePresetId | null> {
  if (pairs.length === 0) return null;

  // role → family 맵을 한 번만 구축
  const pairFamilyByRole: Partial<Record<FontRole, string>> = {};
  for (const p of pairs) {
    const font = await getFont(p.font_id);
    if (font) pairFamilyByRole[p.role] = font.family;
  }

  let best: { id: TonePresetId; matches: number } | null = null;
  for (const preset of TONE_PRESETS) {
    let matches = 0;
    for (const [role, spec] of Object.entries(preset.roles) as Array<
      [FontRole, { family: string; weight: string }]
    >) {
      if (pairFamilyByRole[role] === spec.family) matches++;
    }
    if (matches > 0 && (!best || matches > best.matches)) {
      best = { id: preset.id, matches };
    }
  }
  return best?.id ?? null;
}
