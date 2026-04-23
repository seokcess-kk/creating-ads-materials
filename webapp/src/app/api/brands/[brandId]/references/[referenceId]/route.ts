import { z } from "zod";
import {
  deleteReference,
  updateReferencePerformance,
  updateReferenceWeight,
} from "@/lib/memory";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z
  .object({
    weight: z.number().int().min(0).max(100).optional(),
    performance_score: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine((v) => v.weight !== undefined || v.performance_score !== undefined, {
    message: "weight 또는 performance_score 중 하나는 필요합니다",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ referenceId: string }> },
) {
  try {
    const { referenceId } = await params;
    const input = await parseJson(request, PatchSchema);
    if (input.weight !== undefined) {
      await updateReferenceWeight(referenceId, input.weight);
    }
    if (input.performance_score !== undefined) {
      await updateReferencePerformance(referenceId, input.performance_score);
    }
    return ok({ success: true });
  } catch (e) {
    if (e instanceof ApiError) return serverError(e);
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ referenceId: string }> },
) {
  try {
    const { referenceId } = await params;
    await deleteReference(referenceId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
