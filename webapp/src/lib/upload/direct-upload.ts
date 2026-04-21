// Storage 직접 업로드 유틸 — Vercel 함수 바디 제한(4.5MB)을 우회한다.
// 1) 서버에서 signed upload URL을 발급받고
// 2) supabase-js로 파일을 직접 Storage에 올린 뒤
// 3) 호출자에 public URL을 돌려준다.

import { createClient } from "@/lib/supabase/client";

export type UploadKind = "reference" | "logo" | "key_visual";

export interface SignResponse {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
}

export interface DirectUploadResult {
  publicUrl: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

async function requestSignedUrl(
  brandId: string,
  kind: UploadKind,
  file: File,
): Promise<SignResponse> {
  const res = await fetch(`/api/brands/${brandId}/storage/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "업로드 URL 발급 실패");
  return data as SignResponse;
}

export async function directUpload(
  brandId: string,
  kind: UploadKind,
  file: File,
): Promise<DirectUploadResult> {
  const sign = await requestSignedUrl(brandId, kind, file);
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(sign.bucket)
    .uploadToSignedUrl(sign.path, sign.token, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message || "Storage 업로드 실패");
  return {
    publicUrl: sign.publicUrl,
    path: sign.path,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}
