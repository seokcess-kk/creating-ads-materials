import { createClient } from "@/lib/supabase/server";
import type { DesignReference } from "@/lib/generate/types";
import type {
  BundleConcept,
  CarouselInput,
  CarouselRow,
  CarouselSlideRow,
  CarouselStatus,
} from "./types";
import type { RenderedSlide } from "./generate";

export async function createCarousel(
  input: CarouselInput,
  opts: { status: CarouselStatus; promptVersion: string; title?: string },
): Promise<CarouselRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousels")
    .insert({
      brand_id: input.brandId ?? null,
      title: opts.title ?? input.title ?? "",
      raw_content: input.rawContent.trim(),
      tone_override: input.toneOverride ?? null,
      content_mode: input.contentMode ?? "persuasion",
      bg_mode: input.bgMode ?? "shared",
      reference_url: input.referenceImageUrl ?? null,
      status: opts.status,
      prompt_version: opts.promptVersion,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CarouselRow;
}

export async function updateConcept(
  carouselId: string,
  concept: BundleConcept,
  opts: { status?: CarouselStatus } = {},
): Promise<CarouselRow> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    concept_json: concept,
    title: concept.title,
  };
  if (opts.status) patch.status = opts.status;
  const { data, error } = await supabase
    .from("carousels")
    .update(patch)
    .eq("id", carouselId)
    .select()
    .single();
  if (error) throw error;
  return data as CarouselRow;
}

/** 레퍼런스 분석 결과(DesignReference)를 저장. 생성 직후 콘셉트와 병렬로 추출. */
export async function setCarouselReference(
  carouselId: string,
  designRef: DesignReference,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carousels")
    .update({ reference_json: designRef })
    .eq("id", carouselId);
  if (error) throw error;
}

export async function setCarouselStatus(
  carouselId: string,
  status: CarouselStatus,
  error?: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error: dbErr } = await supabase
    .from("carousels")
    .update({ status, error: error ?? null })
    .eq("id", carouselId);
  if (dbErr) throw dbErr;
}

export async function setCarouselBg(
  carouselId: string,
  bgUrl: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carousels")
    .update({ bg_url: bgUrl })
    .eq("id", carouselId);
  if (error) throw error;
}

export async function getCarousel(
  carouselId: string,
): Promise<{ carousel: CarouselRow; slides: CarouselSlideRow[] } | null> {
  const supabase = await createClient();
  const { data: carousel, error: cErr } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", carouselId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!carousel) return null;
  const { data: slides, error: sErr } = await supabase
    .from("carousel_slides")
    .select("*")
    .eq("carousel_id", carouselId)
    .order("idx", { ascending: true });
  if (sErr) throw sErr;
  return {
    carousel: carousel as CarouselRow,
    slides: (slides ?? []) as CarouselSlideRow[],
  };
}

export async function getSlide(slideId: string): Promise<CarouselSlideRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousel_slides")
    .select("*")
    .eq("id", slideId)
    .maybeSingle();
  if (error) throw error;
  return (data as CarouselSlideRow | null) ?? null;
}

/** 슬라이드 일괄 교체(idx UNIQUE이므로 delete 후 insert). */
export async function replaceSlides(
  carouselId: string,
  slides: RenderedSlide[],
): Promise<CarouselSlideRow[]> {
  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("carousel_slides")
    .delete()
    .eq("carousel_id", carouselId);
  if (delErr) throw delErr;

  const rows = slides.map((s) => ({
    carousel_id: carouselId,
    idx: s.index,
    role: s.role,
    kicker: s.kicker ?? null,
    headline: s.headline,
    body: s.body ?? null,
    visual_json: s.visual ?? {},
    bg_url: s.bg_url,
    image_url: s.image_url,
    image_path: s.image_path,
  }));
  const { data, error } = await supabase
    .from("carousel_slides")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as CarouselSlideRow[];
}

export async function updateSlideCopy(
  slideId: string,
  patch: { kicker?: string | null; headline?: string; body?: string | null },
): Promise<CarouselSlideRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousel_slides")
    .update(patch)
    .eq("id", slideId)
    .select()
    .single();
  if (error) throw error;
  return data as CarouselSlideRow;
}

export async function updateSlideImage(
  slideId: string,
  patch: { image_url: string; image_path: string },
): Promise<CarouselSlideRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousel_slides")
    .update(patch)
    .eq("id", slideId)
    .select()
    .single();
  if (error) throw error;
  return data as CarouselSlideRow;
}

export async function deleteCarousel(carouselId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("carousels").delete().eq("id", carouselId);
  if (error) throw error;
}

export async function listCarousels(limit = 30): Promise<CarouselRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("carousels")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CarouselRow[];
}
