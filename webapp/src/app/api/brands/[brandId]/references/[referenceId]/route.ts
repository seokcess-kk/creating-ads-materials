import { z } from "zod";
import { deleteReference, updateReferenceWeight } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z.object({
  weight: z.number().int().min(0).max(100),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ referenceId: string }> },
) {
  try {
    const { referenceId } = await params;
    const { weight } = await parseJson(request, PatchSchema);
    await updateReferenceWeight(referenceId, weight);
    return ok({ success: true });
  } catch (e) {
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
