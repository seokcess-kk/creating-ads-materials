import { z } from "zod";
import { deleteOffer, updateOffer } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  usp: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  benefits: z.array(z.string()).optional(),
  urgency: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const { offerId } = await params;
    const input = await parseJson(request, PatchSchema);
    const offer = await updateOffer(offerId, input);
    return ok({ offer });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  try {
    const { offerId } = await params;
    await deleteOffer(offerId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
