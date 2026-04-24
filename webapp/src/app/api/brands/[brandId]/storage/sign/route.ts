import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const BUCKET = "brand-assets";
const KEY_VISUAL_BUCKET = "brand-key-visuals";

const SignSchema = z.object({
  kind: z.enum(["reference", "logo", "key_visual"]),
  filename: z.string().min(1).max(255),
  content_type: z.string().max(100).optional(),
});

function sanitize(filename: string): { stem: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  const ext =
    dot >= 0
      ? filename.slice(dot + 1).replace(/[^\w]+/g, "").toLowerCase().slice(0, 10)
      : "";
  const stem = (dot >= 0 ? filename.slice(0, dot) : filename)
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return { stem: stem || "file", ext };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, SignSchema);

    const { stem, ext } = sanitize(input.filename);
    const safeName = `${stem}${ext ? `.${ext}` : ""}`;

    let path: string;
    let bucket: string;
    if (input.kind === "reference") {
      path = `${brandId}/references/${Date.now()}_${safeName}`;
      bucket = BUCKET;
    } else if (input.kind === "logo") {
      const id = globalThis.crypto.randomUUID();
      path = `${brandId}/logos/${id}${ext ? `.${ext}` : ""}`;
      bucket = BUCKET;
    } else {
      const id = globalThis.crypto.randomUUID();
      path = `${brandId}/${id}${ext ? `.${ext}` : ""}`;
      bucket = KEY_VISUAL_BUCKET;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);
    if (error) throw error;
    if (!data) throw new ApiError(500, "서명 URL 생성 실패");

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

    return ok({
      bucket,
      path,
      token: data.token,
      publicUrl: urlData.publicUrl,
    });
  } catch (e) {
    return serverError(e);
  }
}
