import { createClient } from "@/lib/supabase/server";
import type { Brand, BrandMemory } from "./types";
import { getIdentity } from "./identity";
import { listOffers } from "./offers";
import { listAudiences } from "./audiences";
import { listReferences } from "./references";
import { listKeyVisuals } from "./key-visuals";
import { ensureLearnings } from "./learnings";
import { listFontPairs } from "./fonts";

export * from "./types";
export * from "./identity";
export * from "./offers";
export * from "./audiences";
export * from "./references";
export * from "./key-visuals";
export * from "./learnings";
export * from "./fonts";

export async function getBrand(brandId: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw error;
  return (data as Brand | null) ?? null;
}

export async function listBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Brand[];
}

export interface BrandMemoryGap {
  id: string;
  name: string;
  needsIdentity: boolean;
  needsOffer: boolean;
  needsAudience: boolean;
}

/**
 * Identity / Offer / Audience 중 하나라도 미설정인 브랜드 목록.
 * 캠페인 시작 전에 채워야 할 항목을 대시보드에서 안내.
 */
export async function listBrandsWithMemoryGaps(
  limit = 5,
): Promise<BrandMemoryGap[]> {
  const supabase = await createClient();
  const { data: brandsData, error: brandsErr } = await supabase
    .from("brands")
    .select("id, name");
  if (brandsErr) throw brandsErr;
  const brands = (brandsData ?? []) as Array<{ id: string; name: string }>;
  if (brands.length === 0) return [];

  const ids = brands.map((b) => b.id);
  const [identitiesRes, offersRes, audiencesRes] = await Promise.all([
    supabase.from("brand_identity").select("brand_id").in("brand_id", ids),
    supabase.from("brand_offers").select("brand_id").in("brand_id", ids),
    supabase.from("brand_audiences").select("brand_id").in("brand_id", ids),
  ]);
  if (identitiesRes.error) throw identitiesRes.error;
  if (offersRes.error) throw offersRes.error;
  if (audiencesRes.error) throw audiencesRes.error;

  const identitySet = new Set(
    (identitiesRes.data ?? []).map((r) => (r as { brand_id: string }).brand_id),
  );
  const offerSet = new Set(
    (offersRes.data ?? []).map((r) => (r as { brand_id: string }).brand_id),
  );
  const audienceSet = new Set(
    (audiencesRes.data ?? []).map((r) => (r as { brand_id: string }).brand_id),
  );

  const gaps: BrandMemoryGap[] = brands
    .map((b) => ({
      id: b.id,
      name: b.name,
      needsIdentity: !identitySet.has(b.id),
      needsOffer: !offerSet.has(b.id),
      needsAudience: !audienceSet.has(b.id),
    }))
    .filter((g) => g.needsIdentity || g.needsOffer || g.needsAudience);

  return gaps.slice(0, limit);
}

export interface BrandInput {
  name: string;
  website_url?: string | null;
  category?: string | null;
  description?: string | null;
  uses_real_assets?: boolean;
}

export async function createBrand(input: BrandInput): Promise<Brand> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({
      name: input.name,
      website_url: input.website_url ?? null,
      category: input.category ?? null,
      description: input.description ?? null,
      uses_real_assets: input.uses_real_assets ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  const brand = data as Brand;
  await ensureLearnings(brand.id);
  return brand;
}

export async function updateBrand(
  brandId: string,
  input: Partial<BrandInput>,
): Promise<Brand> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .update(input)
    .eq("id", brandId)
    .select()
    .single();
  if (error) throw error;
  return data as Brand;
}

export async function deleteBrand(brandId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brands").delete().eq("id", brandId);
  if (error) throw error;
}

export async function loadBrandMemory(brandId: string): Promise<BrandMemory | null> {
  const brand = await getBrand(brandId);
  if (!brand) return null;

  const [identity, offers, audiences, references, keyVisuals, learnings, fontPairs] =
    await Promise.all([
      getIdentity(brandId),
      listOffers(brandId),
      listAudiences(brandId),
      listReferences(brandId),
      listKeyVisuals(brandId),
      ensureLearnings(brandId),
      listFontPairs(brandId),
    ]);

  return {
    brand,
    identity,
    offers,
    audiences,
    references,
    keyVisuals,
    learnings,
    fontPairs,
  };
}
