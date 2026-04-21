import { createAdminClient } from "@/lib/supabase/admin";
import type { ImagePart } from "@/lib/engines/gemini-image";

export async function uploadGeneratedImage(
  campaignId: string,
  variantLabel: string,
  image: ImagePart,
): Promise<{ url: string; path: string }> {
  const supabase = createAdminClient();
  const ext = image.mimeType.split("/")[1] ?? "png";
  const path = `${campaignId}/visual/${Date.now()}_${variantLabel}.${ext}`;
  const buffer = Buffer.from(image.base64, "base64");

  const { error } = await supabase.storage
    .from("generated-images")
    .upload(path, buffer, { contentType: image.mimeType, upsert: false });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from("generated-images").getPublicUrl(path);
  return { url: urlData.publicUrl, path };
}
