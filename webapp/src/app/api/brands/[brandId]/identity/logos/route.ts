import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentity, upsertIdentity } from "@/lib/memory";
import type { BrandLogos } from "@/lib/memory/types";
import { ApiError, ok, serverError } from "@/lib/api-utils";

const VARIANTS = ["full", "icon", "light", "dark"] as const;
type Variant = (typeof VARIANTS)[number];

function isVariant(v: string): v is Variant {
  return (VARIANTS as readonly string[]).includes(v);
}

function buildPath(brandId: string, variant: Variant, ext: string): string {
  return `${brandId}/logos/${variant}_${Date.now()}.${ext}`;
}

function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx + marker.length);
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const variantRaw = formData.get("variant");

    if (!(file instanceof File)) throw new ApiError(400, "file이 필요합니다");
    if (typeof variantRaw !== "string" || !isVariant(variantRaw)) {
      throw new ApiError(400, `variant는 ${VARIANTS.join("|")} 중 하나여야 합니다`);
    }
    if (!file.type.startsWith("image/")) {
      throw new ApiError(400, "이미지 파일만 허용됩니다");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ApiError(400, "파일 크기는 10MB 이하여야 합니다");
    }

    const variant = variantRaw;
    const supabase = createAdminClient();
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const path = buildPath(brandId, variant, ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const existing = await getIdentity(brandId);
    const prevLogos: BrandLogos = existing?.logo_urls_json ?? {};
    const prevPath = prevLogos[variant]
      ? extractStoragePath(prevLogos[variant]!, "brand-assets")
      : null;

    const nextLogos: BrandLogos = { ...prevLogos, [variant]: publicUrl };
    const identity = await upsertIdentity(brandId, {
      voice: existing?.voice_json ?? {},
      taboos: existing?.taboos ?? [],
      colors: existing?.colors_json ?? [],
      logos: nextLogos,
    });

    if (prevPath && prevPath !== path) {
      await supabase.storage.from("brand-assets").remove([prevPath]);
    }

    return ok({ identity, variant, url: publicUrl });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const url = new URL(request.url);
    const variantRaw = url.searchParams.get("variant");
    if (!variantRaw || !isVariant(variantRaw)) {
      throw new ApiError(400, `variant는 ${VARIANTS.join("|")} 중 하나여야 합니다`);
    }
    const variant = variantRaw;

    const existing = await getIdentity(brandId);
    if (!existing) throw new ApiError(404, "Identity가 없습니다");
    const prevLogos: BrandLogos = existing.logo_urls_json ?? {};
    const targetUrl = prevLogos[variant];
    if (!targetUrl) return ok({ identity: existing });

    const supabase = createAdminClient();
    const storagePath = extractStoragePath(targetUrl, "brand-assets");
    if (storagePath) {
      await supabase.storage.from("brand-assets").remove([storagePath]);
    }

    const nextLogos: BrandLogos = { ...prevLogos };
    delete nextLogos[variant];

    const identity = await upsertIdentity(brandId, {
      voice: existing.voice_json,
      taboos: existing.taboos,
      colors: existing.colors_json,
      logos: nextLogos,
    });

    return ok({ identity });
  } catch (e) {
    return serverError(e);
  }
}
