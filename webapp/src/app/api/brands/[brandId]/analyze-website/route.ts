import { getBrand, updateBrand } from "@/lib/memory";
import { getIdentity, upsertIdentity } from "@/lib/memory/identity";
import { analyzeWebsite } from "@/lib/analysis/analyze-website";
import { ApiError, ok, serverError } from "@/lib/api-utils";
import { z } from "zod";
import type { BrandVoice, BrandColor } from "@/lib/memory/types";

export const maxDuration = 60;

const Body = z
  .object({
    website_url: z.string().url().optional(),
    save_brand_fields: z.boolean().optional(),
    save_identity: z.boolean().optional(),
  })
  .optional();

function mergeUnique<T>(a: T[] | undefined, b: T[] | undefined): T[] {
  const set = new Set<T>();
  const out: T[] = [];
  for (const x of [...(a ?? []), ...(b ?? [])]) {
    if (!set.has(x)) {
      set.add(x);
      out.push(x);
    }
  }
  return out;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const brand = await getBrand(brandId);
    if (!brand) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    let body: {
      website_url?: string;
      save_brand_fields?: boolean;
      save_identity?: boolean;
    } = {};
    try {
      body = Body.parse(await request.json()) ?? {};
    } catch {}

    const url = body.website_url?.trim() || brand.website_url;
    if (!url) throw new ApiError(400, "홈페이지 URL이 필요합니다");

    const result = await analyzeWebsite(url, {
      operation: "analyze_website",
      brandId,
    });

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

    let identitySaved = false;
    if (body.save_identity) {
      const existing = await getIdentity(brandId);
      const a = result.analysis;

      // 기존 값과 merge — 덮어쓰지 않고 추가
      const mergedVoice: BrandVoice = {
        tone: existing?.voice_json?.tone ?? a.voice?.tone ?? "",
        personality: mergeUnique(
          existing?.voice_json?.personality,
          a.voice?.personality,
        ),
        do: mergeUnique(existing?.voice_json?.do, a.voice?.do),
        dont: mergeUnique(existing?.voice_json?.dont, a.voice?.dont),
      };
      const mergedTaboos = mergeUnique(existing?.taboos, a.taboos);

      // colors는 hex 기준으로 dedupe
      const existingHex = new Set(
        (existing?.colors_json ?? []).map((c) => c.hex.toUpperCase()),
      );
      const newColors = (a.colors ?? []).filter(
        (c) => !existingHex.has(c.hex.toUpperCase()),
      );
      const mergedColors: BrandColor[] = [
        ...(existing?.colors_json ?? []),
        ...newColors,
      ];

      const hasAny =
        (mergedVoice.tone && mergedVoice.tone.length > 0) ||
        (mergedVoice.personality?.length ?? 0) > 0 ||
        (mergedVoice.do?.length ?? 0) > 0 ||
        (mergedVoice.dont?.length ?? 0) > 0 ||
        mergedTaboos.length > 0 ||
        mergedColors.length > 0;

      if (hasAny) {
        await upsertIdentity(brandId, {
          voice: mergedVoice,
          taboos: mergedTaboos,
          colors: mergedColors,
          logos: existing?.logos_json ?? [],
        });
        identitySaved = true;
      }
    }

    return ok({ ...result, identitySaved });
  } catch (e) {
    return serverError(e);
  }
}
