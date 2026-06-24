import { createClient } from "@/lib/supabase/server";
import type { ImagePart } from "@/lib/engines/gemini-image";

export async function uploadGeneratedImage(
  campaignId: string,
  variantLabel: string,
  image: ImagePart,
): Promise<{ url: string; path: string }> {
  const supabase = await createClient();
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

/** 더 이상 참조되지 않는 생성물 정리(고아 누적 방지). 호출부에서 best-effort로 사용. */
export async function deleteGeneratedImage(path: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("generated-images").remove([path]);
  if (error) throw error;
}
