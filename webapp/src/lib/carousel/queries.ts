import { createClient } from "@/lib/supabase/server";
import type { DesignReference } from "@/lib/generate/types";
import type {
  BundleConcept,
  CarouselInput,
  CarouselRenderMode,
  CarouselRow,
  CarouselSlideRow,
  CarouselStatus,
  SlideDetail,
} from "./types";

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
      // 기본은 overlay(수정 가능한 광고형) — 정확성·편집성 우선. full(AI 일체형)은 옵트인.
      render_mode: input.renderMode ?? "overlay",
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

/** 유효 렌더 모드를 영속화(텍스트 안전 게이트가 full→overlay로 강등한 결과를 DB·UI·편집과 일치). */
export async function setCarouselRenderMode(
  carouselId: string,
  renderMode: CarouselRenderMode,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carousels")
    .update({ render_mode: renderMode })
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

/**
 * 슬라이드 스켈레톤(텍스트만, 이미지 없음) 일괄 삽입.
 * 상세 카피 확정 직후 호출 → 클라이언트가 폴링으로 골격을 먼저 보고, 이후 이미지가 채워짐.
 * idx UNIQUE이므로 기존 슬라이드는 delete 후 insert.
 */
export async function insertSlideSkeletons(
  carouselId: string,
  details: SlideDetail[],
): Promise<CarouselSlideRow[]> {
  const supabase = await createClient();
  const { error: delErr } = await supabase
    .from("carousel_slides")
    .delete()
    .eq("carousel_id", carouselId);
  if (delErr) throw delErr;

  const rows = details.map((d) => ({
    carousel_id: carouselId,
    idx: d.index,
    role: d.role,
    kicker: d.kicker ?? null,
    headline: d.headline,
    body: d.body ?? null,
    visual_json: d.visual ?? {},
    bg_url: null,
    image_url: null,
    image_path: null,
  }));
  const { data, error } = await supabase
    .from("carousel_slides")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as CarouselSlideRow[];
}

/** 슬라이드 1장의 배경/합성 결과를 기록(점진 렌더 — 완성되는 대로 호출). */
export async function setSlideRendered(
  slideId: string,
  patch: { bg_url: string | null; image_url: string; image_path: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("carousel_slides")
    .update(patch)
    .eq("id", slideId);
  if (error) throw error;
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
