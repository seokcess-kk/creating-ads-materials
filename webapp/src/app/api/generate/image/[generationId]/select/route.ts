import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { setSelectedVariant } from "@/lib/generate/queries";

const Body = z.object({ variantId: z.string().uuid() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  try {
    const { generationId } = await params;
    const { variantId } = await parseJson(request, Body);
    await setSelectedVariant(generationId, variantId);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
