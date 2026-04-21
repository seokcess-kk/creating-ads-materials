import { createAdminClient } from "@/lib/supabase/admin";
import { embedAndStoreBP } from "@/lib/vision";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import type { VisionAnalysis } from "@/lib/memory/types";

export const maxDuration = 300;

/**
 * 기존 BP 중 vision_status=ready 이고 embedding이 없는 row만 순차적으로 임베딩 생성.
 * 마이그레이션 013 적용 직후 한 번 호출하면 된다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("brand_references")
      .select("id, source_type, source_note, vision_analysis_json, embedded_at")
      .eq("brand_id", brandId)
      .eq("vision_status", "ready")
      .is("embedded_at", null);
    if (error) throw new ApiError(500, error.message);

    const rows = (data ?? []) as Array<{
      id: string;
      source_type: string;
      source_note: string | null;
      vision_analysis_json: VisionAnalysis;
    }>;

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const row of rows) {
      try {
        await embedAndStoreBP({
          referenceId: row.id,
          analysis: row.vision_analysis_json,
          sourceType: row.source_type,
          note: row.source_note,
          usageContext: { operation: "bp_embed_backfill", brandId },
        });
        results.push({ id: row.id, ok: true });
      } catch (e) {
        results.push({
          id: row.id,
          ok: false,
          error: (e as Error).message,
        });
      }
    }

    return ok({
      total: rows.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (e) {
    return serverError(e);
  }
}
