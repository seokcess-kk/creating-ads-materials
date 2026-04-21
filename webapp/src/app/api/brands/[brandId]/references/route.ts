import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReference,
  listReferences,
  setVisionFailed,
  setVisionResult,
  type ReferenceSource,
} from "@/lib/memory";
import { analyzeBP } from "@/lib/vision";
import { ApiError, ok, serverError } from "@/lib/api-utils";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "file이 필요합니다");

    const sourceTypeRaw = (formData.get("source_type") as string | null) ?? "bp_upload";
    const validSources: ReferenceSource[] = ["bp_upload", "own_archive", "competitor", "industry"];
    const sourceType = validSources.includes(sourceTypeRaw as ReferenceSource)
      ? (sourceTypeRaw as ReferenceSource)
      : "bp_upload";

    const sourceNote = formData.get("source_note") as string | null;
    const isNegative = formData.get("is_negative") === "true";
    const weightRaw = formData.get("weight");
    const weight = weightRaw != null ? Math.max(0, Math.min(100, Number(weightRaw))) : 50;

    const supabase = createAdminClient();
    const safeName = file.name.replace(/[^\w.\-가-힣]+/g, "_");
    const fileName = `${Date.now()}_${safeName}`;
    const path = `${brandId}/references/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);

    const ref = await createReference(brandId, {
      file_url: urlData.publicUrl,
      file_name: file.name,
      source_type: sourceType,
      source_note: sourceNote,
      is_negative: isNegative,
      weight,
    });

    try {
      const result = await analyzeBP({
        source: { type: "url", url: urlData.publicUrl },
        usageContext: {
          operation: "vision_bp",
          brandId,
        },
      });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
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
