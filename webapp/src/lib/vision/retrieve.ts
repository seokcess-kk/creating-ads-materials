import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, EMBEDDING_MODEL } from "@/lib/engines/embedding";
import { setReferenceEmbedding, getReference } from "@/lib/memory/references";
import type {
  BrandAudience,
  BrandOffer,
  BrandReference,
  VisionAnalysis,
} from "@/lib/memory/types";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import type { UsageContext } from "@/lib/usage/record";

/**
 * BP의 vision_analysis_json을 의미 검색에 적합한 영어 텍스트로 직렬화.
 * 구조적 필드를 나열해 임베딩 공간에서 유사 패턴이 모이도록 설계.
 */
export function bpAnalysisToText(
  a: VisionAnalysis,
  extras?: { sourceType?: string; note?: string | null },
): string {
  const lines: string[] = [];
  if (extras?.sourceType) lines.push(`Source: ${extras.sourceType}`);
  if (extras?.note) lines.push(`Note: ${extras.note}`);
  if (a.copyStructure?.hookType)
    lines.push(`Hook type: ${a.copyStructure.hookType}`);
  if (a.copyStructure?.framework)
    lines.push(`Copy framework: ${a.copyStructure.framework}`);
  if (a.copyStructure?.headlineLen)
    lines.push(`Headline length: ~${a.copyStructure.headlineLen} chars`);
  if (a.hookElement?.type)
    lines.push(`Hook element: ${a.hookElement.type}`);
  if (a.hookElement?.placement)
    lines.push(`Hook placement: ${a.hookElement.placement}`);
  if (a.color?.mood) lines.push(`Mood: ${a.color.mood}`);
  if (a.color?.palette?.length)
    lines.push(`Palette: ${a.color.palette.join(", ")}`);
  if (a.typography?.style) lines.push(`Typography: ${a.typography.style}`);
  if (a.layout?.textZone) lines.push(`Text zone: ${a.layout.textZone}`);
  if (a.layout?.marginRatio != null)
    lines.push(`Margin ratio: ${(a.layout.marginRatio * 100).toFixed(0)}%`);
  if (a.brandElements?.logoPosition)
    lines.push(`Logo position: ${a.brandElements.logoPosition}`);
  if (a.brandElements?.ctaStyle)
    lines.push(`CTA style: ${a.brandElements.ctaStyle}`);
  if (a.funnelFit) {
    const fit = Object.entries(a.funnelFit)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(", ");
    if (fit) lines.push(`Funnel fit: ${fit}`);
  }
  if (a.channelFit) {
    const fit = Object.entries(a.channelFit)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(", ");
    if (fit) lines.push(`Channel fit: ${fit}`);
  }
  if (a.notes) lines.push(`Notes: ${a.notes}`);
  return lines.join("\n");
}

export interface BriefContext {
  brandName: string;
  brandCategory?: string | null;
  offer?: BrandOffer | null;
  audience?: BrandAudience | null;
  intentNote?: string | null;
  strategy?: Pick<
    StrategyAlternative,
    "angleName" | "angleSummary" | "hookType" | "frameworkId" | "visualDirection"
  > | null;
  channel?: string;
  goal?: string;
}

/**
 * 캠페인 브리프를 BP 임베딩 공간과 비교 가능하도록 구조적 텍스트로 직렬화.
 */
export function briefToText(ctx: BriefContext): string {
  const lines: string[] = [];
  lines.push(`Brand: ${ctx.brandName}`);
  if (ctx.brandCategory) lines.push(`Category: ${ctx.brandCategory}`);
  if (ctx.goal) lines.push(`Funnel goal: ${ctx.goal}`);
  if (ctx.channel) lines.push(`Channel: ${ctx.channel}`);

  if (ctx.offer) {
    lines.push(`Offer: ${ctx.offer.title}`);
    if (ctx.offer.usp) lines.push(`USP: ${ctx.offer.usp}`);
    if (ctx.offer.benefits?.length)
      lines.push(`Benefits: ${ctx.offer.benefits.join("; ")}`);
    if (ctx.offer.urgency) lines.push(`Urgency: ${ctx.offer.urgency}`);
    if (ctx.offer.evidence?.length)
      lines.push(`Evidence: ${ctx.offer.evidence.join("; ")}`);
  }
  if (ctx.audience) {
    lines.push(`Persona: ${ctx.audience.persona_name}`);
    if (ctx.audience.pains?.length)
      lines.push(`Pains: ${ctx.audience.pains.join("; ")}`);
    if (ctx.audience.desires?.length)
      lines.push(`Desires: ${ctx.audience.desires.join("; ")}`);
  }
  if (ctx.strategy) {
    lines.push(
      `Strategy: ${ctx.strategy.angleName} (hook=${ctx.strategy.hookType}, framework=${ctx.strategy.frameworkId})`,
    );
    if (ctx.strategy.angleSummary) lines.push(`Angle: ${ctx.strategy.angleSummary}`);
    if (ctx.strategy.visualDirection)
      lines.push(`Visual direction: ${ctx.strategy.visualDirection}`);
  }
  if (ctx.intentNote) lines.push(`Intent: ${ctx.intentNote}`);
  return lines.join("\n");
}

export interface EmbedBPInput {
  referenceId: string;
  analysis: VisionAnalysis;
  sourceType?: string;
  note?: string | null;
  usageContext?: UsageContext;
}

export async function embedAndStoreBP(input: EmbedBPInput): Promise<void> {
  const text = bpAnalysisToText(input.analysis, {
    sourceType: input.sourceType,
    note: input.note,
  });
  if (!text.trim()) return;
  const vector = await embedText({
    text,
    taskType: "RETRIEVAL_DOCUMENT",
    usageContext: input.usageContext,
  });
  await setReferenceEmbedding(input.referenceId, vector, EMBEDDING_MODEL);
}

export interface RelevantBPMatch {
  reference: BrandReference;
  similarity: number;
}

/**
 * brand_id 내에서 쿼리 텍스트와 의미상 가까운 BP Top-K 검색.
 * Supabase RPC match_brand_references 사용.
 */
export async function retrieveRelevantBPs(
  brandId: string,
  queryText: string,
  opts?: {
    limit?: number;
    minSimilarity?: number;
    usageContext?: UsageContext;
  },
): Promise<RelevantBPMatch[]> {
  if (!queryText.trim()) return [];
  const queryVector = await embedText({
    text: queryText,
    taskType: "RETRIEVAL_QUERY",
    usageContext: opts?.usageContext,
  });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_brand_references", {
    p_brand_id: brandId,
    p_embedding: queryVector,
    p_limit: opts?.limit ?? 5,
    p_min_similarity: opts?.minSimilarity ?? 0.3,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; similarity: number }>;
  const results: RelevantBPMatch[] = [];
  for (const row of rows) {
    const ref = await getReference(row.id);
    if (!ref) continue;
    results.push({ reference: ref, similarity: row.similarity });
  }
  return results;
}

/**
 * Top-K BP를 LLM 프롬프트용 digest 블록으로 포맷.
 */
export function formatRelevantBPsDigest(matches: RelevantBPMatch[]): string {
  if (matches.length === 0) return "(관련 BP 없음 — embedding 미생성이거나 유사도 부족)";
  return matches
    .map((m, i) => {
      const a = m.reference.vision_analysis_json;
      const parts: string[] = [];
      if (a.copyStructure?.hookType) parts.push(`hook=${a.copyStructure.hookType}`);
      if (a.copyStructure?.framework) parts.push(`framework=${a.copyStructure.framework}`);
      if (a.hookElement?.type) parts.push(`hookElement=${a.hookElement.type}`);
      if (a.color?.mood) parts.push(`mood=${a.color.mood}`);
      if (a.brandElements?.ctaStyle) parts.push(`cta=${a.brandElements.ctaStyle}`);
      const tag = m.reference.is_negative ? " [NEG]" : "";
      return `  Rel#${i + 1} (sim=${m.similarity.toFixed(2)}, w=${m.reference.weight}${tag}): ${parts.join(", ")}`;
    })
    .join("\n");
}
