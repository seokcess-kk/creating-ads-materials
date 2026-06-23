import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const BUCKET = "generated-images";

const Schema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().max(100).optional(),
});

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0
    ? filename.slice(dot + 1).replace(/[^\w]+/g, "").toLowerCase().slice(0, 10)
    : "";
}

/** 브랜드 비종속 레퍼런스 업로드용 서명 URL(generated-images/refs/<uuid>). */
export async function POST(request: Request) {
  try {
    const { filename } = await parseJson(request, Schema);
    const ext = extOf(filename);
    const id = globalThis.crypto.randomUUID();
    const path = `refs/${id}${ext ? `.${ext}` : ""}`;

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error) throw error;
    if (!data) throw new ApiError(500, "서명 URL 생성 실패");

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return ok({
      bucket: BUCKET,
      path,
      token: data.token,
      publicUrl: urlData.publicUrl,
    });
  } catch (e) {
    return serverError(e);
  }
}
