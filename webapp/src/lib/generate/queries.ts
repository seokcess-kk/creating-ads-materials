import { createClient } from "@/lib/supabase/server";
import type {
  ImageGenerationRow,
  ImageVariantRow,
  SingleImageInput,
  GeneratedImageVariant,
} from "./types";

export async function createGeneration(
  input: SingleImageInput,
  opts: { promptVersion: string },
): Promise<ImageGenerationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("image_generations")
    .insert({
      brand_id: input.brandId ?? null,
      input_json: { ...input },
      // 생성 시작은 pending — 완료 후 setGenerationStatus로 ready/failed 전이(거짓 성공 방지).
      status: "pending",
      prompt_version: opts.promptVersion,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ImageGenerationRow;
}

/** 생성 상태 전이(ready/failed). 부분 실패 요약은 error에 보존. carousel setCarouselStatus와 동형. */
export async function setGenerationStatus(
  generationId: string,
  status: "pending" | "ready" | "failed",
  error?: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error: dbErr } = await supabase
    .from("image_generations")
    .update({ status, error: error ?? null })
    .eq("id", generationId);
  if (dbErr) throw dbErr;
}

export async function insertVariants(
  generationId: string,
  variants: GeneratedImageVariant[],
): Promise<ImageVariantRow[]> {
  const supabase = await createClient();
  const rows = variants.map((v, i) => ({
    generation_id: generationId,
    url: v.url,
    storage_path: v.path,
    label: v.label,
    selected: i === 0, // 첫 후보 기본 선택
    bg_url: v.bgUrl ?? null,
    meta_json: v.meta ?? { mode: v.mode },
  }));
  const { data, error } = await supabase
    .from("image_variants")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as ImageVariantRow[];
}

export async function getVariant(variantId: string): Promise<ImageVariantRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("image_variants")
    .select("*")
    .eq("id", variantId)
    .maybeSingle();
  if (error) throw error;
  return (data as ImageVariantRow | null) ?? null;
}

export async function updateVariantImage(
  variantId: string,
  patch: { url: string; storage_path: string },
): Promise<ImageVariantRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("image_variants")
    .update(patch)
    .eq("id", variantId)
    .select()
    .single();
  if (error) throw error;
  return data as ImageVariantRow;
}

export async function setSelectedVariant(
  generationId: string,
  variantId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error: clearErr } = await supabase
    .from("image_variants")
    .update({ selected: false })
    .eq("generation_id", generationId);
  if (clearErr) throw clearErr;
  const { error: setErr } = await supabase
    .from("image_variants")
    .update({ selected: true })
    .eq("id", variantId)
    .eq("generation_id", generationId);
  if (setErr) throw setErr;
}

export async function getGeneration(
  generationId: string,
): Promise<{ generation: ImageGenerationRow; variants: ImageVariantRow[] } | null> {
  const supabase = await createClient();
  const { data: gen, error: genErr } = await supabase
    .from("image_generations")
    .select("*")
    .eq("id", generationId)
    .maybeSingle();
  if (genErr) throw genErr;
  if (!gen) return null;
  const { data: variants, error: varErr } = await supabase
    .from("image_variants")
    .select("*")
    .eq("generation_id", generationId)
    .order("created_at", { ascending: true });
  if (varErr) throw varErr;
  return {
    generation: gen as ImageGenerationRow,
    variants: (variants ?? []) as ImageVariantRow[],
  };
}

export interface GenerationSummary {
  generation: ImageGenerationRow;
  variants: ImageVariantRow[];
}

/** 갤러리용 — 최근 생성 + 각 후보. */
export async function listGenerations(limit = 30): Promise<GenerationSummary[]> {
  const supabase = await createClient();
  const { data: gens, error: genErr } = await supabase
    .from("image_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (genErr) throw genErr;
  const generations = (gens ?? []) as ImageGenerationRow[];
  if (generations.length === 0) return [];

  const ids = generations.map((g) => g.id);
  const { data: vars, error: varErr } = await supabase
    .from("image_variants")
    .select("*")
    .in("generation_id", ids)
    .order("created_at", { ascending: true });
  if (varErr) throw varErr;
  const variants = (vars ?? []) as ImageVariantRow[];

  const byGen = new Map<string, ImageVariantRow[]>();
  for (const v of variants) {
    const arr = byGen.get(v.generation_id) ?? [];
    arr.push(v);
    byGen.set(v.generation_id, arr);
  }
  return generations.map((g) => ({
    generation: g,
    variants: byGen.get(g.id) ?? [],
  }));
}
