import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteBrand, getBrand, updateBrand, loadBrandMemory } from "@/lib/memory";
import { ok, fail, parseJson, serverError } from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const url = new URL(request.url);
    const withMemory = url.searchParams.get("memory") === "1";

    if (withMemory) {
      const memory = await loadBrandMemory(brandId);
      if (!memory) return fail("브랜드를 찾을 수 없습니다", 404);
      return ok({ memory });
    }
    const brand = await getBrand(brandId);
    if (!brand) return fail("브랜드를 찾을 수 없습니다", 404);
    return ok({ brand });
  } catch (e) {
    return serverError(e);
  }
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  website_url: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, PatchSchema);
    const brand = await updateBrand(brandId, input);
    return ok({ brand });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const supabase = await createClient();
    const buckets = ["brand-assets", "generated-images"];
    for (const bucket of buckets) {
      const { data: files } = await supabase.storage.from(bucket).list(brandId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${brandId}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    }
    await deleteBrand(brandId);
    return ok({ success: true });
  } catch (e) {
    return serverError(e);
  }
}
