import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";
import { recordUsage } from "@/lib/usage/record";
import type {
  AspectRatio,
  ImageSize,
  ImagePart,
  GeneratedImage,
  GenerateImageInput,
  EditImageInput,
} from "./image-types";

// 기존 `@/lib/engines/gemini-image`를 직접 import하던 코드 호환을 위해 타입 재노출
export type { AspectRatio, ImageSize, ImagePart, GeneratedImage, GenerateImageInput, EditImageInput };

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return client;
}

export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const response = await getClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: input.prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: input.aspectRatio ?? "1:1",
        imageSize: input.imageSize ?? "2K",
      },
    },
  });
  const part = extractImagePart(response);

  if (input.usageContext) {
    recordUsage({
      provider: "gemini",
      operation: input.usageContext.operation,
      model: GEMINI_IMAGE_MODEL,
      brandId: input.usageContext.brandId,
      campaignId: input.usageContext.campaignId,
      metadata: {
        ...(input.usageContext.metadata ?? {}),
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
      },
      imageCount: 1,
    }).catch((err) =>
      console.warn("Gemini usage 기록 실패:", (err as Error).message),
    );
  }

  return { ...part, provider: "gemini", model: GEMINI_IMAGE_MODEL, size: input.imageSize ?? "2K" };
}

export async function editImage(input: EditImageInput): Promise<GeneratedImage> {
  const parts = [input.baseImage, ...(input.extraImages ?? [])];
  const response = await getClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      ...parts.map((p) => ({
        inlineData: { mimeType: p.mimeType, data: p.base64 },
      })),
      { text: input.prompt },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: input.aspectRatio ?? "1:1",
        imageSize: input.imageSize ?? "2K",
      },
    },
  });
  const part = extractImagePart(response);

  if (input.usageContext) {
    recordUsage({
      provider: "gemini",
      operation: input.usageContext.operation,
      model: GEMINI_IMAGE_MODEL,
      brandId: input.usageContext.brandId,
      campaignId: input.usageContext.campaignId,
      metadata: {
        ...(input.usageContext.metadata ?? {}),
        aspectRatio: input.aspectRatio,
        imageSize: input.imageSize,
        edit: true,
      },
      imageCount: 1,
    }).catch((err) =>
      console.warn("Gemini usage 기록 실패:", (err as Error).message),
    );
  }

  return { ...part, provider: "gemini", model: GEMINI_IMAGE_MODEL, size: input.imageSize ?? "2K" };
}

type GenAIResponse = Awaited<ReturnType<ReturnType<typeof getClient>["models"]["generateContent"]>>;

function extractImagePart(response: GenAIResponse): ImagePart {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
    if (inline?.mimeType?.startsWith("image/") && inline.data) {
      return { mimeType: inline.mimeType, base64: inline.data };
    }
  }
  throw new Error("Gemini 응답에 이미지가 없습니다");
}
