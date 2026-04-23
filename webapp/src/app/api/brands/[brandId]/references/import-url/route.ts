import { z } from "zod";
import {
  createReference,
  getReferenceBySourceUrl,
  setVisionFailed,
  setVisionResult,
  type ReferenceSource,
} from "@/lib/memory";
import { analyzeBP, embedAndStoreBP } from "@/lib/vision";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import { parseAdUrl, platformLabel } from "@/lib/imports/ads-url-parser";
import { fetchOgMeta } from "@/lib/imports/og-extractor";
import { downloadToReferenceBucket } from "@/lib/imports/store-external-image";

export const maxDuration = 60;

const Schema = z.object({
  url: z.string().url(),
  source_type: z
    .enum(["bp_upload", "own_archive", "competitor", "industry"])
    .optional(),
  source_note: z.string().max(500).nullable().optional(),
  is_negative: z.boolean().optional(),
  weight: z.number().int().min(0).max(100).optional(),
  performance_score: z.number().int().min(1).max(5).nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, Schema);
    const parsed = parseAdUrl(input.url);

    const dup = await getReferenceBySourceUrl(brandId, parsed.canonical);
    if (dup) throw new ApiError(409, "이미 임포트된 광고입니다");

    const og = await fetchOgMeta(parsed.canonical).catch(() => null);
    if (!og?.image) {
      throw new ApiError(
        422,
        `${platformLabel(parsed.platform)}에서 og:image를 찾지 못했습니다. 수동 업로드로 대체하거나 Playwright 경로가 필요합니다.`,
      );
    }

    const stored = await downloadToReferenceBucket(
      brandId,
      og.image,
      parsed.id ?? parsed.platform,
    );

    const noteParts = [platformLabel(parsed.platform)];
    if (og.title) noteParts.push(og.title.slice(0, 120));
    if (input.source_note) noteParts.push(input.source_note);

    const ref = await createReference(brandId, {
      file_url: stored.publicUrl,
      file_name: `${parsed.platform}_${parsed.id ?? Date.now()}.${stored.contentType.split("/")[1] ?? "jpg"}`,
      source_type: (input.source_type ?? "competitor") as ReferenceSource,
      source_note: noteParts.join(" | "),
      source_url: parsed.canonical,
      is_negative: input.is_negative ?? false,
      weight: input.weight ?? 50,
      performance_score: input.performance_score ?? null,
    });

    try {
      const result = await analyzeBP({
        source: { type: "url", url: stored.publicUrl },
        usageContext: { operation: "vision_bp_import_url", brandId },
      });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
      try {
        await embedAndStoreBP({
          referenceId: ref.id,
          analysis: result.analysis,
          sourceType: ref.source_type,
          note: ref.source_note,
          usageContext: { operation: "bp_embed_import_url", brandId },
        });
      } catch (eErr) {
        console.warn("BP embedding 생성 실패:", (eErr as Error).message);
      }
      return ok({
        reference: {
          ...ref,
          vision_analysis_json: result.analysis,
          vision_prompt_version: result.promptVersion,
          vision_status: "ready" as const,
          vision_analyzed_at: new Date().toISOString(),
        },
        meta: { platform: parsed.platform, title: og.title, siteName: og.siteName },
      });
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : String(vErr);
      await setVisionFailed(ref.id, msg);
      return ok({
        reference: { ...ref, vision_status: "failed" as const, vision_error: msg },
        meta: { platform: parsed.platform, title: og.title, siteName: og.siteName },
      });
    }
  } catch (e) {
    return serverError(e);
  }
}
