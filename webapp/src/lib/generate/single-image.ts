import { generateImage, editImage, type AspectRatio, type ImagePart } from "@/lib/engines";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { resizeToChannel } from "@/lib/canvas/resize";
import {
  uploadGeneratedImage,
  deleteGeneratedImage,
} from "@/lib/storage/generated-images";
import { fetchAsBase64, fetchAsBuffer } from "@/lib/utils/image-fetch";
import { analyzeLogos, planLogoPlacement, type LogoCandidate } from "@/lib/canvas/logo-placement";
import { ApiError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { getIdentity } from "@/lib/memory/identity";
import { getVariant, updateVariantImage } from "./queries";
import { singleAdConfig, type SingleAdLogo } from "./render";
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

function decideMode(input: SingleImageInput): SingleRenderMode {
  const hasText = Boolean(input.headline || input.sub || input.cta);
  if (!hasText) return "full"; // 텍스트 없으면 순수 비주얼
  return input.renderMode === "full" ? "full" : "overlay";
}

/** 로고만 오버레이(어둠 처리 없이). full/edit 모드에서 베이킹된 이미지 위에 로고 1개를 얹는다. */
async function composeLogoOnly(buf: Buffer, logo: SingleAdLogo): Promise<Buffer> {
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    overlay: { top: false, bottom: false },
    logo: {
      buffer: logo.buffer,
      url: logo.url,
      position: logo.position ?? "top-left",
      widthRatio: 0.16,
      marginRatio: 0.05,
      backingColor: logo.backingColor ?? null,
    },
  };
  return renderComposite(buf, config);
}

/**
 * 단일 이미지 N장 후보 생성.
 *  - 의도/맥락을 크리에이티브 브리프로 모아 아트디렉터(Claude)가 gpt-image 프롬프트 N개로 확장.
 *  - 브랜드: 카테고리(프롬프트 힌트)만 모델에 주입. 로고는 모델에 굽지 않고 생성 후 컴포지터로
 *    정확히 1개 오버레이(배경 대비에 맞춰 모서리·에셋 선택·가독성 패널). 색상은 CTA 버튼에만.
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

  // 로고는 모델에 굽지 않는다(중복·왜곡 방지) → 입력 이미지는 base 레퍼런스(변형 대상)만.
  const baseRef = isEdit && refUrl ? await fetchAsBase64(refUrl).catch(() => null) : null;
  const inputImages: ImagePart[] = [baseRef].filter(
    (p): p is ImagePart => p != null,
  );

  // 브랜드 로고는 생성당 1회만 받아 휘도 분석(후보별 배경 대비에 맞춰 1개 선택·배치).
  const logoAssets: LogoCandidate[] = brand.logos.length
    ? await analyzeLogos(
        brand.logos.map((l) => l.url),
        fetchAsBuffer,
      )
    : [];

  // 아트디렉터: 브리프 → gpt-image 프롬프트 N개 (실패 시 템플릿 폴백). 로고는 합성 단계라 hasLogo=false.
  const brief: CreativeBrief = {
    keyMessage: input.keyMessage,
    concept: input.concept ?? null,
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
    let p: string;
    if (isEdit) {
      p = buildEditPrompt({
        mode,
        keyMessage: input.keyMessage,
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
        keyMessage: input.keyMessage,
        concept: input.concept,
        tone: input.tone,
        brand,
        styleHint,
        designRef: designRefText,
      });
    } else {
      p = buildFullImagePrompt({
        keyMessage: input.keyMessage,
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
    return p;
  }

  // 로고 버퍼를 컴포지터에 직접 전달(fetch 없이). 포맷은 sharp가 내용으로 판별.
  function logoForCompositor(
    placement: { url: string; position: SingleAdLogo["position"]; backingColor: string | null } | null,
  ): SingleAdLogo | null {
    if (!placement) return null;
    const asset = logoAssets.find((a) => a.url === placement.url);
    if (!asset) return null;
    return {
      buffer: asset.buf,
      position: placement.position,
      backingColor: placement.backingColor,
    };
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const prompt = directed?.[i]?.prompt ?? fallbackPrompt(i);
      const label = directed?.[i]?.label || `v${i + 1}`;
      const useEdit = inputImages.length > 0;
      const usageContext = {
        operation: useEdit ? "single_image_edit" : "single_image_gen",
        brandId: input.brandId ?? null,
        metadata: { generationId, i, mode, refMode: refUrl ? refMode : "none" },
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

      // variant 추적 메타(meta_json) — 어떤 프롬프트/모델/사이즈/합성으로 만들어졌는지 보존.
      const meta: Record<string, unknown> = {
        mode,
        label,
        prompt,
        promptVersion: SINGLE_IMAGE_PROMPT_VERSION,
        provider: base.provider,
        model: base.model,
        size: base.size ?? null,
        aspectRatio,
        refMode: refUrl ? refMode : "none",
      };

      // 2) overlay면 배경을 채널 픽셀로 맞춰 보존(재합성용) 후 한글/로고/CTA 오버레이.
      if (mode === "overlay" && hasText) {
        const bgBuf = await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
        // 오버레이는 그라데이션+스크림으로 배경이 어두워지므로 darken을 반영해 로고 대비를 판단.
        const placement = await planLogoPlacement(bgBuf, logoAssets, { darken: 0.55 });
        const config = singleAdConfig({
          headline: input.headline,
          sub: input.sub,
          cta: input.cta,
          logo: logoForCompositor(placement),
          brandColor: brand.ctaColor,
        });
        // bg 보존 업로드와 합성은 둘 다 bgBuf에만 의존 → 병렬(핫패스 지연 단축).
        const [bgUploaded, composed] = await Promise.all([
          uploadGeneratedImage(generationId, `bg_v${i + 1}`, {
            mimeType: "image/png",
            base64: bgBuf.toString("base64"),
          }),
          renderComposite(bgBuf, config),
        ]);
        const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, {
          mimeType: "image/png",
          base64: composed.toString("base64"),
        });
        // 재합성은 실제 로고 URL을 다시 받아 쓰므로 meta엔 data URL이 아닌 실제 URL/배치 저장. 합성 카피도 보존.
        meta.compose = {
          logoUrl: placement?.url ?? null,
          logoPosition: placement?.position ?? null,
          logoBacking: placement?.backingColor ?? null,
          brandColor: brand.ctaColor,
          headline: input.headline ?? null,
          sub: input.sub ?? null,
          cta: input.cta ?? null,
        };
        return {
          label,
          url: uploaded.url,
          path: uploaded.path,
          mode: "overlay",
          bgUrl: bgUploaded.url,
          meta,
        } satisfies GeneratedImageVariant;
      }

      // full/edit: 텍스트가 이미지에 베이킹됨(재합성 불가). 비율이 맞을 때만 스케일(crop 금지 — 잘림 방지).
      let finalBuf = await resizeToChannel(
        Buffer.from(base.base64, "base64"),
        aspectRatio,
        { allowCrop: false },
      );
      // 로고는 모델에 굽지 않고 여기서 1개만 오버레이(어둠 처리 없이 로고만). 배경 대비로 모서리·에셋 선택.
      const fullPlacement = await planLogoPlacement(finalBuf, logoAssets);
      const fullLogo = logoForCompositor(fullPlacement);
      if (fullLogo) {
        finalBuf = await composeLogoOnly(finalBuf, fullLogo);
        meta.logo = {
          url: fullPlacement?.url ?? null,
          position: fullPlacement?.position ?? null,
          backing: fullPlacement?.backingColor ?? null,
        };
      }
      const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, {
        mimeType: "image/png",
        base64: finalBuf.toString("base64"),
      });
      return {
        label,
        url: uploaded.url,
        path: uploaded.path,
        mode: isEdit ? "edit" : "full",
        bgUrl: null,
        meta,
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

/**
 * 카피 수정 후 단일 이미지 후보 재합성 — 보존된 배경(bg_url)을 재사용하며 이미지 모델을 호출하지 않는다.
 * overlay 후보만 가능(full/edit는 텍스트가 이미지에 베이킹됨). 캐러셀 recomposeSlide와 동형.
 * 인가: getVariant/updateVariantImage는 인증 클라이언트(createClient)로 RLS(owner 스코프)가 강제된다.
 * admin 클라이언트로 바꾸면 IDOR 위험이 생기므로 유지할 것.
 */
export async function recomposeVariant(
  generationId: string,
  input: {
    variantId: string;
    headline?: string | null;
    sub?: string | null;
    cta?: string | null;
  },
): Promise<{ id: string; url: string; path: string }> {
  const variant = await getVariant(input.variantId);
  if (!variant || variant.generation_id !== generationId) {
    throw new ApiError(404, "후보를 찾을 수 없습니다");
  }
  const bgUrl = variant.bg_url;
  if (!bgUrl) {
    throw new ApiError(400, "이 후보는 재합성할 수 없습니다(overlay 후보만 가능)");
  }

  // 카피가 전부 비면 텍스트 없는 어두운 배경만 남아 기존 소재를 파괴하므로 거부.
  const hasCopy = Boolean(
    input.headline?.trim() || input.sub?.trim() || input.cta?.trim(),
  );
  if (!hasCopy) {
    throw new ApiError(400, "카피를 1개 이상 입력하세요");
  }

  const meta = (variant.meta_json ?? {}) as Record<string, unknown>;
  const compose =
    (meta.compose as {
      logoUrl?: string | null;
      logoPosition?: SingleAdLogo["position"];
      logoBacking?: string | null;
      brandColor?: string | null;
    }) ?? {};
  const bgBuf = await fetchAsBuffer(bgUrl);
  const config = singleAdConfig({
    headline: input.headline,
    sub: input.sub,
    cta: input.cta,
    // 생성 시 결정된 로고 배치(위치·가독성 패널)를 그대로 재현.
    logo: compose.logoUrl
      ? {
          url: compose.logoUrl,
          position: compose.logoPosition,
          backingColor: compose.logoBacking ?? null,
        }
      : null,
    brandColor: compose.brandColor ?? null,
  });
  const composed = await renderComposite(bgBuf, config);
  // storage 경로 안전성을 위해 표시 라벨 대신 variant id 사용(공백·한글 회피).
  const uploaded = await uploadGeneratedImage(generationId, `re_${variant.id}`, {
    mimeType: "image/png",
    base64: composed.toString("base64"),
  });
  // 합성 카피를 meta에 갱신해 추적/이력을 정확히 유지.
  const newMeta = {
    ...meta,
    compose: {
      ...compose,
      headline: input.headline ?? null,
      sub: input.sub ?? null,
      cta: input.cta ?? null,
    },
  };
  const prevPath = variant.storage_path;
  const row = await updateVariantImage(variant.id, {
    url: uploaded.url,
    storage_path: uploaded.path,
    meta_json: newMeta,
  });
  // 직전 합성본은 더 이상 참조되지 않으므로 정리(고아 누적 방지). 배경(bg_url)은 재사용하므로 보존.
  if (prevPath && prevPath !== uploaded.path) {
    await deleteGeneratedImage(prevPath).catch(() => {});
  }
  return { id: row.id, url: row.url, path: row.storage_path };
}
