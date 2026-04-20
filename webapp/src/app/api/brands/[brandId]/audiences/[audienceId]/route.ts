import { z } from "zod";
import { deleteAudience, updateAudience } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

const PatchSchema = z.object({
  persona_name: z.string().min(1).optional(),
  demographics: z.record(z.string(), z.unknown()).optional(),
  language_level: z.string().nullable().optional(),
  pains: z.array(z.string()).optional(),
  desires: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ audienceId: string }> },
) {
  try {
    const { audienceId } = await params;
    const input = await parseJson(request, PatchSchema);
    const audience = await updateAudience(audienceId, input);
    return ok({ audience });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ audienceId: string }> },
) {
  try {
    const { audienceId } = await params;
    await deleteAudience(audienceId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
