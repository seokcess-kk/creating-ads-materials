import { serverEnv } from "@/lib/env";
import type {
  GenerateImageInput,
  EditImageInput,
  GeneratedImage,
} from "./image-types";
import * as gemini from "./gemini-image";
import * as openai from "./openai-image";

// 이미지 생성 provider를 IMAGE_PROVIDER env로 분기한다.
// Gemini는 임베딩에도 쓰이므로 fallback으로 항상 보존한다.
// provider는 호출 시점에 평가해 import 시 env 미설정으로 부팅이 깨지지 않게 한다.
function provider() {
  return serverEnv().IMAGE_PROVIDER;
}

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  return provider() === "gemini"
    ? gemini.generateImage(input)
    : openai.generateImage(input);
}

export async function editImage(input: EditImageInput): Promise<GeneratedImage> {
  return provider() === "gemini"
    ? gemini.editImage(input)
    : openai.editImage(input);
}

export type {
  AspectRatio,
  ImageSize,
  ImagePart,
  GeneratedImage,
  GenerateImageInput,
  EditImageInput,
} from "./image-types";
