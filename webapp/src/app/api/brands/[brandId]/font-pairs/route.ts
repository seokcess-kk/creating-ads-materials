import { z } from "zod";
import { listFontPairs, upsertFontPair } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const pairs = await listFontPairs(brandId);
    return ok({ pairs });
  } catch (e) {
    return serverError(e);
  }
}

const UpsertSchema = z.object({
  role: z.enum(["headline", "sub", "cta", "brand", "slogan"]),
  font_id: z.string().uuid(),
  hierarchy_ratio: z.number().positive().default(1.0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, UpsertSchema);
    const pair = await upsertFontPair(brandId, input.role, input.font_id, input.hierarchy_ratio);
    return ok({ pair });
  } catch (e) {
    return serverError(e);
  }
}
