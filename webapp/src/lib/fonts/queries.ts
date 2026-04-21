import { createAdminClient } from "@/lib/supabase/admin";
import type { FontRow, FontTier } from "@/lib/memory/types";

export interface FontQueryOptions {
  tier?: FontTier | FontTier[];
  category?: string;
  toneTags?: string[];
  family?: string;
  search?: string;
  limit?: number;
}

// tier1(public/fonts bundled) > tier2(CDN URL) > tier3(기타 URL) > tier0(repo/fonts, Vercel 미배포)
// 프로덕션 번들에 실재 파일이 있는 tier 우선.
const TIER_PRIORITY: Record<FontTier, number> = {
  tier1: 0,
  tier2: 1,
  tier3: 2,
  tier0: 3,
};

function sortByTierPriority<T extends { tier: FontTier }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier]);
}

export async function listFonts(options: FontQueryOptions = {}): Promise<FontRow[]> {
  const supabase = createAdminClient();
  let query = supabase.from("fonts").select("*");

  if (options.tier) {
    if (Array.isArray(options.tier)) query = query.in("tier", options.tier);
    else query = query.eq("tier", options.tier);
  }
  if (options.category) query = query.eq("category", options.category);
  if (options.toneTags && options.toneTags.length > 0) {
    query = query.contains("tone_tags", options.toneTags);
  }
  if (options.family) query = query.ilike("family", `%${options.family}%`);
  if (options.search) query = query.ilike("family", `%${options.search}%`);

  query = query.order("family").order("weight");
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return sortByTierPriority((data ?? []) as FontRow[]);
}

export async function getFont(fontId: string): Promise<FontRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("fonts")
    .select("*")
    .eq("id", fontId)
    .maybeSingle();
  if (error) throw error;
  return (data as FontRow | null) ?? null;
}

export async function findFont(
  family: string,
  weight: string | null,
  tier?: FontTier,
): Promise<FontRow | null> {
  const supabase = createAdminClient();
  let query = supabase.from("fonts").select("*").eq("family", family);
  if (weight) query = query.eq("weight", weight);
  if (tier) query = query.eq("tier", tier);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as FontRow[];
  if (rows.length === 0) return null;
  return sortByTierPriority(rows)[0];
}
