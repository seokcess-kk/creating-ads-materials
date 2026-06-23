import type { UsageContext } from "@/lib/usage/record";

// 이미지 엔진 공용 계약. Gemini·OpenAI 두 구현이 동일 시그니처를 공유한다.
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "4:3";
export type ImageSize = "1K" | "2K" | "4K";

export interface ImagePart {
  mimeType: string;
  /** 순수 base64 (data: URL 아님) */
  base64: string;
}

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  usageContext?: UsageContext;
}

export interface EditImageInput {
  prompt: string;
  baseImage: ImagePart;
  /** 추가 참조 이미지(예: 브랜드 로고). 모델이 함께 보고 통합/변형. */
  extraImages?: ImagePart[];
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
  usageContext?: UsageContext;
}
