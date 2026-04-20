import { z } from "zod";
import { createAudience, listAudiences } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const audiences = await listAudiences(brandId);
    return ok({ audiences });
  } catch (e) {
    return serverError(e);
  }
}

const CreateSchema = z.object({
  persona_name: z.string().min(1),
  demographics: z.record(z.string(), z.unknown()).optional(),
  language_level: z.string().nullable().optional(),
  pains: z.array(z.string()).optional(),
  desires: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, CreateSchema);
    const audience = await createAudience(brandId, input);
    return ok({ audience });
  } catch (e) {
    return serverError(e);
  }
}
