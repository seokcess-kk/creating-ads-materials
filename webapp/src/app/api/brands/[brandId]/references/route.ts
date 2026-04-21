import { z } from "zod";
import {
  createReference,
  listReferences,
  setVisionFailed,
  setVisionResult,
  type ReferenceSource,
} from "@/lib/memory";
import { analyzeBP, embedAndStoreBP } from "@/lib/vision";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const references = await listReferences(brandId);
    return ok({ references });
  } catch (e) {
    return serverError(e);
  }
}

const PostSchema = z.object({
  file_url: z.string().url(),
  file_name: z.string().max(255).optional(),
  source_type: z
    .enum(["bp_upload", "own_archive", "competitor", "industry"])
    .optional(),
  source_note: z.string().max(500).nullable().optional(),
  is_negative: z.boolean().optional(),
  weight: z.number().min(0).max(100).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, PostSchema);

    const ref = await createReference(brandId, {
      file_url: input.file_url,
      file_name: input.file_name ?? null,
      source_type: (input.source_type ?? "bp_upload") as ReferenceSource,
      source_note: input.source_note ?? null,
      is_negative: input.is_negative ?? false,
      weight: input.weight ?? 50,
    });

    try {
      const result = await analyzeBP({
        source: { type: "url", url: input.file_url },
        usageContext: {
          operation: "vision_bp",
          brandId,
        },
      });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
      try {
        await embedAndStoreBP({
          referenceId: ref.id,
          analysis: result.analysis,
          sourceType: ref.source_type,
          note: ref.source_note,
          usageContext: { operation: "bp_embed", brandId },
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
      });
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : String(vErr);
      await setVisionFailed(ref.id, msg);
      return ok({
        reference: { ...ref, vision_status: "failed" as const, vision_error: msg },
      });
    }
  } catch (e) {
    return serverError(e);
  }
}
