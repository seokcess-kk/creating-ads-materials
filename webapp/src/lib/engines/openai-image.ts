import OpenAI, { toFile } from "openai";
import { serverEnv } from "@/lib/env";
import { recordUsage } from "@/lib/usage/record";
import type {
  AspectRatio,
  ImageSize,
  GeneratedImage,
  ImageTokenUsage,
  GenerateImageInput,
  EditImageInput,
} from "./image-types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const key = serverEnv().OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다 (IMAGE_PROVIDER=openai). .env.local을 확인하세요.",
    );
  }
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

// 최신 모델/단가는 OpenAI 문서로 확인 후 갱신할 것.
// gpt-image-2: 지시 준수·텍스트(한국어) 렌더 품질 우선. 대안: gpt-image-1.5 / gpt-image-1 / gpt-image-1-mini.
export const OPENAI_IMAGE_MODEL = "gpt-image-2";

type OpenAISize = "1024x1024" | "1024x1536" | "1536x1024";
type OpenAIQuality = "low" | "medium" | "high";
const OUTPUT_FORMAT = "png" as const;

// 안정성 위해 OpenAI 표준 3종 size로 근사 생성한다. 광고 비율(9:16·4:5)은 portrait로 받고,
// 정확한 채널 픽셀은 생성 후 resizeToChannel(@/lib/canvas/resize)로 cover-crop해 맞춘다.
// (gpt-image-2는 임의 해상도도 지원하나 2K 초과는 실험적이라 표준 3종 유지.)
function sizeForAspect(aspect: AspectRatio | undefined): OpenAISize {
  switch (aspect) {
    case "9:16":
    case "4:5":
    case "3:4":
      return "1024x1536";
    case "16:9":
    case "4:3":
      return "1536x1024";
    case "1:1":
    default:
      return "1024x1024";
  }
}

// Gemini의 imageSize(1K/2K/4K)에 대응 개념이 없어 quality로 매핑한다.
function qualityForSize(size: ImageSize | undefined): OpenAIQuality {
  switch (size) {
    case "4K":
    case "2K":
      return "high";
    case "1K":
    default:
      return "medium";
  }
}

// OpenAI 이미지 응답의 토큰 사용량(있을 때). gpt-image 계열은 토큰 과금이라 비용 추정에 직결된다.
interface OpenAIUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { image_tokens?: number; text_tokens?: number };
}

function toTokenUsage(usage: OpenAIUsage | undefined): ImageTokenUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    textInputTokens: usage.input_tokens_details?.text_tokens,
    imageInputTokens: usage.input_tokens_details?.image_tokens,
  };
}

function record(
  usageContext: GenerateImageInput["usageContext"],
  size: OpenAISize,
  quality: OpenAIQuality,
  aspectRatio: AspectRatio | undefined,
  imageSize: ImageSize | undefined,
  edit: boolean,
  usage: ImageTokenUsage | undefined,
  inputImageCount: number | undefined,
): void {
  if (!usageContext) return;
  recordUsage({
    provider: "openai",
    operation: usageContext.operation,
    model: OPENAI_IMAGE_MODEL,
    brandId: usageContext.brandId,
    campaignId: usageContext.campaignId,
    runId: usageContext.runId,
    imageCount: 1,
    imageDimensions: size,
    imageQuality: quality,
    // 토큰이 있으면 토큰 기반 단가로 계산됨(record.ts). 없으면 장당 테이블 폴백.
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    openaiTextInputTokens: usage?.textInputTokens,
    openaiImageInputTokens: usage?.imageInputTokens,
    inputImageCount,
    metadata: {
      ...(usageContext.metadata ?? {}),
      aspectRatio,
      imageSize,
      ...(edit ? { edit: true } : {}),
    },
  }).catch((err) =>
    console.warn("OpenAI usage 기록 실패:", (err as Error).message),
  );
}

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const size = sizeForAspect(input.aspectRatio);
  const quality = qualityForSize(input.imageSize);
  const response = await getClient().images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt: input.prompt,
    size,
    quality,
    output_format: OUTPUT_FORMAT,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 응답에 이미지가 없습니다");

  const usage = toTokenUsage(response.usage);
  record(input.usageContext, size, quality, input.aspectRatio, input.imageSize, false, usage, 0);
  return {
    mimeType: `image/${OUTPUT_FORMAT}`,
    base64: b64,
    provider: "openai",
    model: OPENAI_IMAGE_MODEL,
    size,
    usage,
  };
}

export async function editImage(input: EditImageInput): Promise<GeneratedImage> {
  const size = sizeForAspect(input.aspectRatio);
  const quality = qualityForSize(input.imageSize);

  // base64 → File (마스크 없이 프롬프트만으로 편집). 여러 장이면 배열로 전달
  // (gpt-image는 다중 입력 이미지를 지원 — 예: 베이스 + 브랜드 로고).
  const parts = [input.baseImage, ...(input.extraImages ?? [])];
  const files = await Promise.all(
    parts.map(async (p, i) => {
      const buffer = Buffer.from(p.base64, "base64");
      const ext = p.mimeType.split("/")[1] ?? "png";
      return toFile(buffer, `img_${i}.${ext}`, { type: p.mimeType });
    }),
  );

  const response = await getClient().images.edit({
    model: OPENAI_IMAGE_MODEL,
    image: files.length > 1 ? files : files[0],
    prompt: input.prompt,
    size,
    quality,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI 응답에 이미지가 없습니다");

  const usage = toTokenUsage(response.usage);
  record(input.usageContext, size, quality, input.aspectRatio, input.imageSize, true, usage, parts.length);
  return {
    mimeType: `image/${OUTPUT_FORMAT}`,
    base64: b64,
    provider: "openai",
    model: OPENAI_IMAGE_MODEL,
    size,
    usage,
  };
}
