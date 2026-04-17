import { getGeminiClient } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateAdImage(
  prompt: string,
  aspectRatio: string,
  campaignId: string,
  fileName: string,
): Promise<string> {
  const genai = getGeminiClient();

  const response = await genai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K",
      },
    },
  });

  // 이미지 추출
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith("image/")) {
      const imageBuffer = Buffer.from(part.inlineData.data!, "base64");

      // Supabase Storage에 업로드
      const supabase = createAdminClient();
      const path = `${campaignId}/${fileName}`;

      const { error } = await supabase.storage
        .from("generated-images")
        .upload(path, imageBuffer, {
          contentType: part.inlineData.mimeType,
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("generated-images")
        .getPublicUrl(path);

      return urlData.publicUrl;
    }
  }

  throw new Error("이미지 생성 실패: 응답에 이미지가 없습니다");
}
