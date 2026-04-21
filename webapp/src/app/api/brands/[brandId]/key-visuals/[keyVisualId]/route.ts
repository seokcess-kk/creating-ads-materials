import { z } from "zod";
import {
  deleteKeyVisual,
  getKeyVisual,
  updateKeyVisual,
} from "@/lib/memory/key-visuals";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  is_primary: z.boolean().optional(),
  mood_tags: z.array(z.string().max(40)).max(10).optional(),
  description: z.string().max(400).nullable().optional(),
  focal_area: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().min(0).max(1),
      h: z.number().min(0).max(1),
    })
    .nullable()
    .optional(),
});

async function assertOwned(brandId: string, keyVisualId: string) {
  const kv = await getKeyVisual(keyVisualId);
  if (!kv) throw new ApiError(404, "Key Visual을 찾을 수 없습니다");
  if (kv.brand_id !== brandId)
    throw new ApiError(403, "이 브랜드의 자산이 아닙니다");
  return kv;
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ brandId: string; keyVisualId: string }>;
  },
) {
  try {
    const { brandId, keyVisualId } = await params;
    await assertOwned(brandId, keyVisualId);
    const patch = await parseJson(request, PatchSchema);
    const updated = await updateKeyVisual(keyVisualId, patch);
    return ok({ keyVisual: updated });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ brandId: string; keyVisualId: string }>;
  },
) {
  try {
    const { brandId, keyVisualId } = await params;
    await assertOwned(brandId, keyVisualId);
    await deleteKeyVisual(keyVisualId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
