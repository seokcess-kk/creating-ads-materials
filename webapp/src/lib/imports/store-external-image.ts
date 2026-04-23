import { createAdminClient } from "@/lib/supabase/admin";

// storage/sign 라우트의 reference 경로 규칙과 동일하게 유지.
const BUCKET = "brand-assets";
const MAX_BYTES = 15 * 1024 * 1024;

const USER_AGENT =
  "Mozilla/5.0 (compatible; CreativeBPImporter/1.0)";

export interface StoredImage {
  publicUrl: string;
  path: string;
  contentType: string;
  size: number;
}

/**
 * 외부 이미지 URL을 서버에서 받아 Supabase storage(brand-assets/references/)에 업로드.
 * Vision 분석·embedding은 호출자(API 라우트)가 이어서 수행한다.
 */
export async function downloadToReferenceBucket(
  brandId: string,
  imageUrl: string,
  suggestedName?: string,
): Promise<StoredImage> {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`이미지 다운로드 실패: HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error(`이미지 컨텐츠 타입이 아닙니다: ${contentType}`);
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error("이미지가 15MB를 초과합니다");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("이미지가 15MB를 초과합니다");

  const ext = contentType.split("/")[1] ?? "jpg";
  const stem = sanitizeStem(suggestedName ?? "imported");
  const path = `${brandId}/references/${Date.now()}_${stem}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    publicUrl: urlData.publicUrl,
    path,
    contentType,
    size: buf.byteLength,
  };
}

function sanitizeStem(name: string): string {
  return (
    name
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "imported"
  );
}
