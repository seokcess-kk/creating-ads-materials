import { generateImage, editImage, type AspectRatio } from "@/lib/engines";
import { renderComposite } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import { getIdentity } from "@/lib/memory/identity";
import { singleAdConfig } from "./render";
import {
  buildTextlessBackgroundPrompt,
  buildFullImagePrompt,
  buildEditPrompt,
  buildBrandContext,
  EMPTY_BRAND_CONTEXT,
  type BrandContext,
} from "./prompt";
import type {
  SingleImageInput,
  SingleImageResult,
  GeneratedImageVariant,
  SingleRenderMode,
} from "./types";

export const SINGLE_IMAGE_PROMPT_VERSION = "single@0.1.0";

// 후보별 다양성 — 프롬프트에 스타일 변주를 인덱스로 주입(랜덤 대신 결정적).
const STYLE_HINTS = [
  "minimal and clean composition with generous negative space",
  "bold, vivid colors with strong focal contrast",
  "warm, emotional lifestyle atmosphere with soft natural light",
  "premium editorial look with refined details",
];

function decideMode(input: SingleImageInput): SingleRenderMode {
  const hasText = Boolean(input.headline || input.sub || input.cta);
  if (!hasText) return "full"; // 텍스트 없으면 순수 비주얼
  return input.renderMode === "full" ? "full" : "overlay";
}

/**
 * 단일 이미지 N장 후보 생성.
 *  - overlay: 텍스트 없는 배경(generate/edit) → 컴포지터 한글 오버레이
 *  - full:    이미지에 텍스트까지 베이킹(또는 텍스트 없는 순수 비주얼)
 *  - 참고이미지가 있으면 editImage로 베이스를 생성.
 */
export async function generateSingleImageVariants(
  generationId: string,
  input: SingleImageInput,
): Promise<SingleImageResult> {
  const aspectRatio: AspectRatio = input.aspectRatio ?? "1:1";
  const count = Math.min(Math.max(input.count ?? 3, 1), 4);
  const mode = decideMode(input);

  let brand: BrandContext = EMPTY_BRAND_CONTEXT;
  if (input.brandId) {
    try {
      brand = buildBrandContext(await getIdentity(input.brandId));
    } catch {
      brand = EMPTY_BRAND_CONTEXT;
    }
  }

  const reference = input.referenceImageUrl
    ? await fetchAsBase64(input.referenceImageUrl)
    : null;

  const textFields = {
    headline: input.headline,
    sub: input.sub,
    cta: input.cta,
  };

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const styleHint = STYLE_HINTS[i % STYLE_HINTS.length];
      const label = `v${i + 1}`;
      const usageContext = {
        operation: mode === "overlay" ? "single_image_bg" : "single_image_full",
        brandId: input.brandId ?? null,
        metadata: { generationId, label, mode, styleHint },
      };

      // 1) 베이스 이미지
      let base;
      if (reference) {
        const prompt = buildEditPrompt({
          mode,
          concept: input.concept,
          tone: input.tone,
          brand,
          styleHint,
          ...textFields,
        });
        base = await editImage({
          prompt,
          baseImage: reference,
          aspectRatio,
          imageSize: "1K",
          usageContext: { ...usageContext, operation: "single_image_edit" },
        });
      } else if (mode === "overlay") {
        const prompt = buildTextlessBackgroundPrompt({
          concept: input.concept,
          tone: input.tone,
          brand,
          styleHint,
        });
        base = await generateImage({ prompt, aspectRatio, imageSize: "1K", usageContext });
      } else {
        const prompt = buildFullImagePrompt({
          concept: input.concept,
          tone: input.tone,
          brand,
          styleHint,
          ...textFields,
        });
        base = await generateImage({ prompt, aspectRatio, imageSize: "1K", usageContext });
      }

      // 2) overlay면 한글 텍스트 합성, 아니면 베이스 그대로 업로드
      if (mode === "overlay") {
        const bgBuf = Buffer.from(base.base64, "base64");
        const config = singleAdConfig({
          headline: input.headline,
          sub: input.sub,
          cta: input.cta,
          logoUrl: brand.logoUrl,
          brandColor: brand.primaryColor,
        });
        const composed = await renderComposite(bgBuf, config);
        const uploaded = await uploadGeneratedImage(generationId, label, {
          mimeType: "image/png",
          base64: composed.toString("base64"),
        });
        return {
          label,
          url: uploaded.url,
          path: uploaded.path,
          mode: "overlay",
        } satisfies GeneratedImageVariant;
      }

      const uploaded = await uploadGeneratedImage(generationId, label, base);
      return {
        label,
        url: uploaded.url,
        path: uploaded.path,
        mode: reference ? "edit" : "full",
      } satisfies GeneratedImageVariant;
    }),
  );

  const variants: GeneratedImageVariant[] = [];
  const failures: Array<{ label: string; reason: string }> = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") variants.push(r.value);
    else
      failures.push({
        label: `v${i + 1}`,
        reason: (r.reason as Error)?.message ?? "unknown",
      });
  });

  if (variants.length === 0) {
    throw new Error(
      `모든 변형 실패 — ${failures.map((f) => `${f.label}: ${f.reason}`).join(" / ")}`,
    );
  }

  return { variants, failures };
}
