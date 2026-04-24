import { createClient } from "@/lib/supabase/server";
import type { BrandOffer } from "./types";

export async function listOffers(brandId: string): Promise<BrandOffer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_offers")
    .select("*")
    .eq("brand_id", brandId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrandOffer[];
}

export async function getOffer(offerId: string): Promise<BrandOffer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (error) throw error;
  return (data as BrandOffer | null) ?? null;
}

export interface OfferInput {
  title: string;
  usp?: string | null;
  price?: string | null;
  benefits?: string[];
  urgency?: string | null;
  evidence?: string[];
  is_default?: boolean;
}

async function clearDefault(brandId: string) {
  const supabase = await createClient();
  await supabase.from("brand_offers").update({ is_default: false }).eq("brand_id", brandId);
}

export async function createOffer(brandId: string, input: OfferInput): Promise<BrandOffer> {
  const supabase = await createClient();
  if (input.is_default) await clearDefault(brandId);
  const { data, error } = await supabase
    .from("brand_offers")
    .insert({
      brand_id: brandId,
      title: input.title,
      usp: input.usp ?? null,
      price: input.price ?? null,
      benefits: input.benefits ?? [],
      urgency: input.urgency ?? null,
      evidence: input.evidence ?? [],
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrandOffer;
}

export async function updateOffer(
  offerId: string,
  input: Partial<OfferInput>,
): Promise<BrandOffer> {
  const supabase = await createClient();
  if (input.is_default) {
    const existing = await getOffer(offerId);
    if (existing) await clearDefault(existing.brand_id);
  }
  const { data, error } = await supabase
    .from("brand_offers")
    .update(input)
    .eq("id", offerId)
    .select()
    .single();
  if (error) throw error;
  return data as BrandOffer;
}

export async function deleteOffer(offerId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_offers").delete().eq("id", offerId);
  if (error) throw error;
}
