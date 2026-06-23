import { generateImage, editImage, type AspectRatio, type ImagePart } from "@/lib/engines";
import { renderComposite } from "@/lib/canvas/compositor";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import { getBrand } from "@/lib/memory";
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

export const SINGLE_IMAGE_PROMPT_VERSION = "single@0.3.0";

// 아트디렉터 실패 시 폴백용 — 후보별 스타일 변주(결정적).
const STYLE_HINTS = [
  "minimal and clean composition with generous negative space",
  "bold, vivid colors with strong focal contrast",
  "warm, emotional lifestyle atmosphere with soft natural light",
  "premium editorial look with refined details",
];

const LOGO_NOTE =
  " Integrate the provided brand logo into the scene naturally and keep it undistorted and legible (small, in a corner or subtly on the product). Do not alter its letters or shape.";

function decideMode(input: SingleImageInput): SingleRenderMode {
  const hasText = Boolean(input.headline || input.sub || input.cta);
  if (!hasText) return "full"; // 텍스트 없으면 순수 비주얼
  return input.renderMode === "full" ? "full" : "overlay";
}

/**
 * 단일 이미지 N장 후보 생성.
 *  - 의도/맥락을 크리에이티브 브리프로 모아 아트디렉터(Claude)가 gpt-image 프롬프트 N개로 확장.
 *  - 브랜드: 카테고리(프롬프트 힌트) + 로고(입력 이미지로 전달해 통합). 색상은 미사용.
 *  - 레퍼런스: style(디자인 요소만 차용) / base(레퍼런스 자체를 변형).
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

  // 선택적 브랜드 컨텍스트(카테고리 + 로고만)
  let brand: BrandContext = EMPTY_BRAND_CONTEXT;
  if (input.brandId) {
    try {
      const [b, identity] = await Promise.all([
        getBrand(input.brandId),
        getIdentity(input.brandId),
      ]);
      brand = buildBrandContext(b, identity);
    } catch {
      brand = EMPTY_BRAND_CONTEXT;
    }
  }

  // 레퍼런스 처리
  const refUrl = input.referenceImageUrl?.trim() || null;
  const refMode: ReferenceMode = input.referenceMode ?? "style";
  const isEdit = Boolean(refUrl) && refMode === "base";

  // 업로드 시 이미 분석했으면(input.designRef) 재분석 생략, 아니면 style 모드에서 분석.
  let designRef: DesignReference | null = input.designRef ?? null;
  if (!designRef && refUrl && refMode === "style") {
    designRef = await analyzeReferenceDesign(refUrl, {
      operation: "single_image_ref_analyze",
      brandId: input.brandId ?? null,
      metadata: { generationId },
    });
  }

  // 입력 이미지: base 레퍼런스(변형 대상) + 브랜드 로고(통합 대상)
  const [baseRef, logo] = await Promise.all([
    isEdit && refUrl ? fetchAsBase64(refUrl) : Promise.resolve(null),
    brand.logoUrl ? fetchAsBase64(brand.logoUrl).catch(() => null) : Promise.resolve(null),
  ]);
  const inputImages: ImagePart[] = [baseRef, logo].filter(
    (p): p is ImagePart => p != null,
  );
  const hasLogo = logo != null;

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
    hasLogo,
  };
  const directed = await buildImagePrompts(brief, count, {
    operation: "single_image_art_director",
    brandId: input.brandId ?? null,
    metadata: { generationId, mode, refMode: refUrl ? refMode : "none", hasLogo },
  });

  const designRefText = designRef ? formatDesignReference(designRef) : null;
  function fallbackPrompt(i: number): string {
    const styleHint = STYLE_HINTS[i % STYLE_HINTS.length];
    let p: string;
    if (isEdit) {
      p = buildEditPrompt({
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
    } else if (mode === "overlay") {
      p = buildTextlessBackgroundPrompt({
        concept: input.concept,
        tone: input.tone,
        brand,
        styleHint,
        designRef: designRefText,
      });
    } else {
      p = buildFullImagePrompt({
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
    return hasLogo ? p + LOGO_NOTE : p;
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const prompt = directed?.[i]?.prompt ?? fallbackPrompt(i);
      const label = directed?.[i]?.label || `v${i + 1}`;
      const useEdit = inputImages.length > 0;
      const usageContext = {
        operation: useEdit ? "single_image_edit" : "single_image_gen",
        brandId: input.brandId ?? null,
        metadata: { generationId, i, mode, refMode: refUrl ? refMode : "none", hasLogo },
      };

      // 1) 베이스 이미지 (입력 이미지가 있으면 edit, 없으면 text-to-image)
      const base = useEdit
        ? await editImage({
            prompt,
            baseImage: inputImages[0],
            extraImages: inputImages.slice(1),
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
