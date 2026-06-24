import type { UsageContext } from "@/lib/usage/record";

// 이미지 엔진 공용 계약. Gemini·OpenAI 두 구현이 동일 시그니처를 공유한다.
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "4:3";
export type ImageSize = "1K" | "2K" | "4K";

export interface ImagePart {
  mimeType: string;
  /** 순수 base64 (data: URL 아님) */
  base64: string;
}

/** 이미지 생성 응답의 토큰 사용량(provider가 제공할 때). 비용 추정·추적용. */
export interface ImageTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  textInputTokens?: number;
  imageInputTokens?: number;
}

/**
 * 생성 결과 + 추적 메타. ImagePart를 확장하므로 base64만 쓰던 기존 호출부와 호환된다.
 * provider/model/size/usage는 usage 기록과 variant meta_json 추적에 쓰인다.
 */
export interface GeneratedImage extends ImagePart {
  provider: "openai" | "gemini";
  model: string;
  /** 실제 생성 사이즈 라벨(OpenAI size 또는 Gemini imageSize) */
  size?: string;
  usage?: ImageTokenUsage;
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
