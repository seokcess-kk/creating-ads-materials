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
import { analyzeReferenceDesign, formatDesignReference } from "./analyze-reference";
import { buildImagePrompts, type CreativeBrief } from "./art-director";
import type {
  SingleImageInput,
  SingleImageResult,
  GeneratedImageVariant,
  SingleRenderMode,
  ReferenceMode,
  DesignReference,
} from "./types";

export const SINGLE_IMAGE_PROMPT_VERSION = "single@0.2.0";

// 아트디렉터 실패 시 폴백용 — 후보별 스타일 변주(결정적).
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
 *  - 사용자의 의도/맥락을 크리에이티브 브리프로 모아 아트디렉터(Claude)가
 *    gpt-image 최적화 프롬프트 N개로 확장 → 각 프롬프트로 생성.
 *  - 레퍼런스: style(디자인 요소만 차용) / base(레퍼런스 자체를 editImage로 변형).
 *  - overlay 모드면 텍스트 없는 배경에 컴포지터로 한글 오버레이.
 */
export async function generateSingleImageVariants(
  generationId: string,
  input: SingleImageInput,
): Promise<SingleImageResult> {
  const aspectRatio: AspectRatio = input.aspectRatio ?? "1:1";
  const count = Math.min(Math.max(input.count ?? 3, 1), 4);
  const mode = decideMode(input);
  const hasText = Boolean(input.headline || input.sub || input.cta);

  // 선택적 브랜드 컨텍스트(컬러/로고/톤)
  let brand: BrandContext = EMPTY_BRAND_CONTEXT;
  if (input.brandId) {
    try {
      brand = buildBrandContext(await getIdentity(input.brandId));
    } catch {
      brand = EMPTY_BRAND_CONTEXT;
    }
  }

  // 레퍼런스 처리
  const refUrl = input.referenceImageUrl?.trim() || null;
  const refMode: ReferenceMode = input.referenceMode ?? "style";
  const isEdit = Boolean(refUrl) && refMode === "base";

  let designRef: DesignReference | null = null;
  if (refUrl && refMode === "style") {
    designRef = await analyzeReferenceDesign(refUrl, {
      operation: "single_image_ref_analyze",
      brandId: input.brandId ?? null,
      metadata: { generationId },
    });
  }
  const reference = isEdit && refUrl ? await fetchAsBase64(refUrl) : null;

  // 아트디렉터: 브리프 → gpt-image 프롬프트 N개 (실패 시 템플릿 폴백)
  const brief: CreativeBrief = {
    concept: input.concept,
    keyMessage: input.keyMessage,
    copy: { headline: input.headline, sub: input.sub, cta: input.cta },
    tone: input.tone,
    brandHint: brand.promptHint || null,
    designRef,
    aspectRatio,
    mode,
    isEdit,
  };
  const directed = await buildImagePrompts(brief, count, {
    operation: "single_image_art_director",
    brandId: input.brandId ?? null,
    metadata: { generationId, mode, refMode: refUrl ? refMode : "none" },
  });

  const designRefText = designRef ? formatDesignReference(designRef) : null;
  function fallbackPrompt(i: number): string {
    const styleHint = STYLE_HINTS[i % STYLE_HINTS.length];
    if (isEdit) {
      return buildEditPrompt({
        mode,
        concept: input.concept,
        tone: input.tone,
        brand,
        styleHint,
        designRef: designRefText,
        headline: input.headline,
        sub: input.sub,
        cta: input.cta,
      });
    }
    if (mode === "overlay") {
      return buildTextlessBackgroundPrompt({
        concept: input.concept,
        tone: input.tone,
        brand,
        styleHint,
        designRef: designRefText,
      });
    }
    return buildFullImagePrompt({
      concept: input.concept,
      tone: input.tone,
      brand,
      styleHint,
      designRef: designRefText,
      headline: input.headline,
      sub: input.sub,
      cta: input.cta,
    });
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const prompt = directed?.[i]?.prompt ?? fallbackPrompt(i);
      const label = directed?.[i]?.label || `v${i + 1}`;
      const usageContext = {
        operation: isEdit ? "single_image_edit" : "single_image_gen",
        brandId: input.brandId ?? null,
        metadata: { generationId, i, mode, refMode: refUrl ? refMode : "none" },
      };

      // 1) 베이스 이미지
      const base = reference
        ? await editImage({
            prompt,
            baseImage: reference,
            aspectRatio,
            imageSize: "1K",
            usageContext,
          })
        : await generateImage({ prompt, aspectRatio, imageSize: "1K", usageContext });

      // 2) overlay면 한글 텍스트 합성, 아니면 베이스 그대로 업로드
      if (mode === "overlay" && hasText) {
        const bgBuf = Buffer.from(base.base64, "base64");
        const config = singleAdConfig({
          headline: input.headline,
          sub: input.sub,
          cta: input.cta,
          logoUrl: brand.logoUrl,
          brandColor: brand.primaryColor,
        });
        const composed = await renderComposite(bgBuf, config);
        const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, {
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

      const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, base);
      return {
        label,
        url: uploaded.url,
        path: uploaded.path,
        mode: isEdit ? "edit" : "full",
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
