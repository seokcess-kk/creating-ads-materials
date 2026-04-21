import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

const BUCKET = "brand-assets";

const SignSchema = z.object({
  kind: z.enum(["reference", "logo"]),
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
    if (input.kind === "reference") {
      path = `${brandId}/references/${Date.now()}_${safeName}`;
    } else {
      const id = globalThis.crypto.randomUUID();
      path = `${brandId}/logos/${id}${ext ? `.${ext}` : ""}`;
    }

    const supabase = createAdminClient();
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
