import { z } from "zod";
import { createOffer, listOffers } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const offers = await listOffers(brandId);
    return ok({ offers });
  } catch (e) {
    return serverError(e);
  }
}

const CreateSchema = z.object({
  title: z.string().min(1),
  usp: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  benefits: z.array(z.string()).optional(),
  urgency: z.string().nullable().optional(),
  evidence: z.array(z.string()).optional(),
  is_default: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, CreateSchema);
    const offer = await createOffer(brandId, input);
    return ok({ offer });
  } catch (e) {
    return serverError(e);
  }
}
