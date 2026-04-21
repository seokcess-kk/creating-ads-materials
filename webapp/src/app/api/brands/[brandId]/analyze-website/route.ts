import { getBrand, updateBrand } from "@/lib/memory";
import { analyzeWebsite } from "@/lib/analysis/analyze-website";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";

export const maxDuration = 60;

const Body = z
  .object({
    website_url: z.string().url().optional(),
    save_brand_fields: z.boolean().optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const brand = await getBrand(brandId);
    if (!brand) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    let body: { website_url?: string; save_brand_fields?: boolean } = {};
    try {
      body = Body.parse(await request.json()) ?? {};
    } catch {}

    const url = body.website_url?.trim() || brand.website_url;
    if (!url) throw new ApiError(400, "홈페이지 URL이 필요합니다");

    const result = await analyzeWebsite(url);

    if (body.save_brand_fields) {
      const updates: { category?: string; description?: string; website_url?: string } = {};
      if (!brand.website_url && body.website_url) updates.website_url = url;
      if (result.analysis.category && !brand.category) {
        updates.category = result.analysis.category;
      }
      if (result.analysis.description && !brand.description) {
        updates.description = result.analysis.description;
      }
      if (Object.keys(updates).length > 0) {
        await updateBrand(brandId, updates);
      }
    }

    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
