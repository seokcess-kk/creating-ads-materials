import { z } from "zod";
import { createBrand, listBrands } from "@/lib/memory";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export async function GET() {
  try {
    const brands = await listBrands();
    return ok({ brands });
  } catch (e) {
    return serverError(e);
  }
}

const CreateSchema = z.object({
  name: z.string().min(1),
  website_url: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, CreateSchema);
    const brand = await createBrand(input);
    return ok({ brand });
  } catch (e) {
    return serverError(e);
  }
}
