import {
  getReference,
  setVisionFailed,
  setVisionPending,
  setVisionResult,
} from "@/lib/memory";
import { analyzeBP } from "@/lib/vision";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ referenceId: string }> },
) {
  try {
    const { referenceId } = await params;
    const ref = await getReference(referenceId);
    if (!ref) throw new ApiError(404, "레퍼런스를 찾을 수 없습니다");

    await setVisionPending(referenceId);

    try {
      const result = await analyzeBP({
        source: { type: "url", url: ref.file_url },
      });
      await setVisionResult(referenceId, result.analysis, result.promptVersion);
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
      await setVisionFailed(referenceId, msg);
      throw new ApiError(500, `Vision 재분석 실패: ${msg}`);
    }
  } catch (e) {
    return serverError(e);
  }
}
