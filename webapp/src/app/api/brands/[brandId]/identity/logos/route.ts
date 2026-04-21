import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentity, upsertIdentity } from "@/lib/memory";
import type { BrandLogo } from "@/lib/memory/types";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

// POST: 새 로고 업로드 → logos 배열에 추가
export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    const labelRaw = formData.get("label");

    if (!(file instanceof File)) throw new ApiError(400, "file이 필요합니다");
    if (!file.type.startsWith("image/")) {
      throw new ApiError(400, "이미지 파일만 허용됩니다");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ApiError(400, "파일 크기는 10MB 이하여야 합니다");
    }

    const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim() : undefined;

    const supabase = createAdminClient();
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const id = randomId();
    const path = `${brandId}/logos/${id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const existing = await getIdentity(brandId);
    const prev: BrandLogo[] = existing?.logos_json ?? [];

    // 첫 로고라면 자동으로 primary
    const newLogo: BrandLogo = {
      id,
      url: publicUrl,
      label,
      is_primary: prev.length === 0,
    };

    const identity = await upsertIdentity(brandId, {
      voice: existing?.voice_json,
      taboos: existing?.taboos,
      colors: existing?.colors_json,
      logos: [...prev, newLogo],
    });

    return ok({ identity, logo: newLogo });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH: 라벨 변경 / primary 지정
const PatchSchema = z.object({
  logo_id: z.string().uuid(),
  label: z.string().max(50).nullable().optional(),
  is_primary: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, PatchSchema);

    const existing = await getIdentity(brandId);
    if (!existing) throw new ApiError(404, "Identity가 없습니다");

    const prev = existing.logos_json ?? [];
    const target = prev.find((l) => l.id === input.logo_id);
    if (!target) throw new ApiError(404, "로고를 찾을 수 없습니다");

    const next: BrandLogo[] = prev.map((l) => {
      const updated = { ...l };
      if (l.id === input.logo_id) {
        if (input.label !== undefined) {
          updated.label = input.label ?? undefined;
        }
      }
      // primary 변경: 대상 true, 나머지 false (exclusive)
      if (input.is_primary === true) {
        updated.is_primary = l.id === input.logo_id;
      } else if (input.is_primary === false && l.id === input.logo_id) {
        updated.is_primary = false;
      }
      return updated;
    });

    const identity = await upsertIdentity(brandId, {
      voice: existing.voice_json,
      taboos: existing.taboos,
      colors: existing.colors_json,
      logos: next,
    });

    return ok({ identity });
  } catch (e) {
    return serverError(e);
  }
}

// DELETE: 로고 제거 (by id)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const url = new URL(request.url);
    const logoId = url.searchParams.get("logo_id");
    if (!logoId) throw new ApiError(400, "logo_id가 필요합니다");

    const existing = await getIdentity(brandId);
    if (!existing) throw new ApiError(404, "Identity가 없습니다");

    const prev = existing.logos_json ?? [];
    const target = prev.find((l) => l.id === logoId);
    if (!target) return ok({ identity: existing });

    // Storage에서 파일 삭제
    const supabase = createAdminClient();
    const storagePath = extractStoragePath(target.url, "brand-assets");
    if (storagePath) {
      await supabase.storage.from("brand-assets").remove([storagePath]);
    }

    const next = prev.filter((l) => l.id !== logoId);
    // primary였으면 남은 것 중 첫 번째를 primary로
    if (target.is_primary && next.length > 0 && !next.some((l) => l.is_primary)) {
      next[0] = { ...next[0], is_primary: true };
    }

    const identity = await upsertIdentity(brandId, {
      voice: existing.voice_json,
      taboos: existing.taboos,
      colors: existing.colors_json,
      logos: next,
    });

    return ok({ identity });
  } catch (e) {
    return serverError(e);
  }
}
