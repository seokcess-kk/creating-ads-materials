import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";
import { recordUsage, type UsageContext } from "@/lib/usage/record";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return client;
}

export const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "4:3";
export type ImageSize = "1K" | "2K" | "4K";

export interface ImagePart {
  mimeType: string;
  base64: string;
}

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  usageContext?: UsageContext;
}

export async function generateImage(input: GenerateImageInput): Promise<ImagePart> {
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

  return part;
}

export interface EditImageInput {
  prompt: string;
  baseImage: ImagePart;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  usageContext?: UsageContext;
}

export async function editImage(input: EditImageInput): Promise<ImagePart> {
  const response = await getClient().models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: input.baseImage.mimeType,
          data: input.baseImage.base64,
        },
      },
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

  return part;
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
