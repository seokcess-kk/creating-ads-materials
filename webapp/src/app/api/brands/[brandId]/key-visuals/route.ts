import { z } from "zod";
import {
  createKeyVisual,
  listKeyVisuals,
  setKeyVisualVisionFailed,
  setKeyVisualVisionResult,
} from "@/lib/memory/key-visuals";
import { analyzeKeyVisual } from "@/lib/vision/key-visual";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const keyVisuals = await listKeyVisuals(brandId);
    return ok({ keyVisuals });
  } catch (e) {
    return serverError(e);
  }
}

const PostSchema = z.object({
  storage_url: z.string().url(),
  kind: z.enum(["person", "space", "product"]),
  label: z.string().min(1).max(120),
  is_primary: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, PostSchema);

    const kv = await createKeyVisual(brandId, {
      storage_url: input.storage_url,
      kind: input.kind,
      label: input.label,
      is_primary: input.is_primary ?? false,
    });

    try {
      const result = await analyzeKeyVisual({
        source: { type: "url", url: input.storage_url },
        kind: input.kind,
        usageContext: {
          operation: "vision_key_visual",
          brandId,
        },
      });
      await setKeyVisualVisionResult(kv.id, {
        description: result.analysis.description,
        mood_tags: result.analysis.mood_tags,
      });
      return ok({
        keyVisual: {
          ...kv,
          description: result.analysis.description,
          mood_tags: result.analysis.mood_tags,
          vision_status: "ready" as const,
          vision_analyzed_at: new Date().toISOString(),
        },
      });
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : String(vErr);
      await setKeyVisualVisionFailed(kv.id, msg);
      return ok({
        keyVisual: {
          ...kv,
          vision_status: "failed" as const,
          vision_error: msg,
        },
      });
    }
  } catch (e) {
    return serverError(e);
  }
}
