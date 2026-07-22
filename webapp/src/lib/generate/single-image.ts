import { generateImage, editImage, type AspectRatio, type ImagePart } from "@/lib/engines";
import { renderComposite } from "@/lib/canvas/compositor";
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
import { assertCopyFitsTypography, singleAdConfig, fullHybridConfig, type SingleAdLogo } from "./render";
// 레퍼런스 타이포 → 설치 한글 폰트 매핑(캐러셀 인프라 재사용 — 단일 overlay에도 적용).
import { fontSetForReference } from "@/lib/carousel/style";
import {
  buildTextlessBackgroundPrompt,
  buildFullImagePrompt,
  buildBrandContext,
  EMPTY_BRAND_CONTEXT,
  type BrandContext,
} from "./prompt";
import { analyzeReferenceDesign, formatDesignReference } from "./analyze-reference";
import { buildImagePrompts, type CreativeBrief } from "./art-director";
import { anyNeedsOverlay } from "@/lib/text/bake-policy";
import { copyZoneCorrection, findBusyCopyZones } from "./quality";
import type {
  SingleImageInput,
  SingleImageResult,
  GeneratedImageVariant,
  SingleRenderMode,
  ReferenceStrength,
  DesignReference,
  CopyPosition,
  ReferenceFontCategory,
} from "./types";

export const SINGLE_IMAGE_PROMPT_VERSION = "single@0.5.0";

// 아트디렉터 실패 시 폴백용 — 후보별 스타일 변주(결정적).
const STYLE_HINTS = [
  "minimal and clean composition with generous negative space",
  "bold, vivid colors with strong focal contrast",
  "warm, emotional lifestyle atmosphere with soft natural light",
  "premium editorial look with refined details",
];

/**
 * 레퍼런스 픽셀 참조 가드 — 프롬프트 뒤에 붙여 editImage 입력 이미지의 역할을 고정한다.
 * 캐러셀 generateSlideImage 가드와 동형(157284e) + 단일 이미지의 layout(템플릿) 강도 확장.
 *  - style: 색·조명·무드·구도만 따라가고 장면은 완전히 새로(콘텐츠 복제 억제).
 *  - layout: 배치·타이포 위계·장식 요소까지 템플릿처럼 유지, 내용(피사체·문구)만 교체.
 */
function referenceGuard(
  strength: Exclude<ReferenceStrength, "mood">,
  rendersText: boolean,
): string {
  if (strength === "layout") {
    return rendersText
      ? "\n\nDESIGN TEMPLATE REFERENCE — TYPOGRAPHY IS A HARD CONSTRAINT: Treat the attached image as a pixel-level design template. Preserve the exact text-block bounding boxes, baselines, alignment, line count, line-height, relative font sizes, weight, width/condensation, tracking, colors, outline/shadow treatment, and whitespace. Match the reference typeface's visible glyph personality as closely as the image model can (serif shape, terminals, stroke contrast, roundness, counters), not merely its broad font category. Render ONLY the new Korean text specified above, fitted into the same boxes without inventing, duplicating, or retaining any reference letters. Preserve the exact layout, grid, element placement, decorative elements, palette, lighting and mood. Swap subjects/content only. Do NOT copy reference logos, photos or products. Before finalizing, visually compare the new typography against the attached reference and correct any drift in geometry or styling."
      : "\n\nDESIGN TEMPLATE REFERENCE: The attached image is a design TEMPLATE to follow closely — replicate its exact layout, grid, element placement, decorative elements, color palette, lighting and mood, so the result reads as another version of the same design. Swap ONLY the content to the new subject/scene described above, and produce a fully TEXTLESS composition: where the reference has text, leave those areas as clean, empty space (Korean copy is composited there later). Do NOT copy the reference's literal text, logos, photos or products.";
  }
  return rendersText
    ? "\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood, composition and typographic feel so the result reads as designed after it. Build an ENTIRELY NEW image: do NOT copy its subjects, objects, photos, logos, or ANY of its text/letters/numbers. Render ONLY the Korean text specified above."
    : "\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood and composition. Create an ENTIRELY NEW, fully TEXTLESS composition: do NOT copy its subjects, objects, photos, text, or logos.";
}

function decideMode(input: SingleImageInput): SingleRenderMode {
  const hasText = Boolean(input.headline || input.sub || input.cta);
  if (!hasText) return "full"; // 텍스트 없으면 순수 비주얼
  if (input.renderMode !== "full") return "overlay";
  // 'AI 일체형'(full) 요청이라도 정확한 날짜·금액·연락처나 긴 본문이 있으면 후합성으로 안전 강등
  // (모델이 구운 정확 데이터는 오타·날조 위험 + 수정 불가). 가이드: 정확 데이터는 굽지 말 것.
  if (anyNeedsOverlay(input.headline, input.sub, input.cta)) return "overlay";
  return "full";
}

/**
 * 단일 이미지 N장 후보 생성.
 *  - 의도/맥락을 크리에이티브 브리프로 모아 아트디렉터(Claude)가 gpt-image 프롬프트 N개로 확장.
 *  - 브랜드: 카테고리(프롬프트 힌트)만 모델에 주입. 로고는 모델에 굽지 않고 생성 후 컴포지터로
 *    정확히 1개 오버레이(배경 대비에 맞춰 모서리·에셋 선택·가독성 패널). 색상은 CTA 버튼에만.
 *  - 레퍼런스 강도: mood(텍스트 요약만) / style(픽셀 직접 참조 — 색·구도·무드 강반영) /
 *    layout(템플릿처럼 배치·타이포까지 유지). style/layout은 editImage로 레퍼런스를 모델에 보여준다.
 *  - overlay 모드면 텍스트 없는 배경에 컴포지터로 한글 오버레이.
 */
export async function generateSingleImageVariants(
  generationId: string,
  raw: SingleImageInput,
): Promise<SingleImageResult> {
  // 용도 정규화 — 광고 지면(ad, 기본)은 매체가 네이티브 CTA 버튼을 제공하므로
  // 이미지 속 '가짜 버튼'이 생기지 않게 CTA를 서버에서도 제거한다(클라이언트 미적용 대비).
  const input: SingleImageInput =
    (raw.placement ?? "ad") === "ad" && raw.cta ? { ...raw, cta: null } : raw;
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

  // 레퍼런스 처리 — 강도 결정(구 referenceMode 호환: base=변형 → layout, style → style).
  const refUrl = input.referenceImageUrl?.trim() || null;
  const refStrength: ReferenceStrength | null = refUrl
    ? (input.referenceStrength ??
      (input.referenceMode === "base" ? "layout" : "style"))
    : null;

  // 구 분석 결과에는 구조화 textLayers가 없으므로 텍스트가 있는 레퍼런스 생성은 자동 재분석한다.
  // 새 분석이 실패하면 기존 요약을 유지해 생성 자체는 계속한다.
  let designRef: DesignReference | null = input.designRef ?? null;
  const needsLayerAnalysis = Boolean(refUrl && hasText && designRef?.analysisVersion !== 2);
  if (refUrl && (!designRef || needsLayerAnalysis)) {
    const analyzed = await analyzeReferenceDesign(refUrl, {
      operation: "single_image_ref_analyze",
      brandId: input.brandId ?? null,
      metadata: { generationId, reason: needsLayerAnalysis ? "missing_text_layers" : "missing_design_ref" },
    });
    designRef = analyzed ?? designRef;
  }

  if (mode === "overlay" && designRef?.typography) {
    assertCopyFitsTypography({
      headline: input.headline,
      sub: input.sub,
      typography: designRef.typography,
    });
  }

  // 픽셀 직접 참조(캐러셀 157284e와 동형) — mood는 텍스트 요약만 쓰고, style/layout은
  // editImage로 레퍼런스 픽셀을 모델에 보여줘 색·구도·무드가 요약을 거치지 않고 반영되게 한다.
  // 로고는 모델에 굽지 않는다(중복·왜곡 방지) → 입력 이미지는 레퍼런스뿐.
  const refImage: ImagePart | null =
    refUrl && refStrength && refStrength !== "mood"
      ? await fetchAsBase64(refUrl).catch(() => null)
      : null;

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
    lighting: input.lighting ?? null,
    palette: input.palette ?? null,
    mood: input.mood ?? null,
    copyPosition: input.copyPosition ?? null,
    brandHint: brand.promptHint || null,
    designRef,
    aspectRatio,
    mode,
    refStrength,
  };
  const directed = await buildImagePrompts(brief, count, {
    operation: "single_image_art_director",
    brandId: input.brandId ?? null,
    metadata: { generationId, mode, refStrength: refStrength ?? "none" },
  });

  const designRefText = designRef ? formatDesignReference(designRef) : null;
  function fallbackPrompt(i: number): string {
    const styleHint = STYLE_HINTS[i % STYLE_HINTS.length];
    let p: string;
    if (mode === "overlay") {
      p = buildTextlessBackgroundPrompt({
        keyMessage: input.keyMessage,
        concept: input.concept,
        tone: input.tone,
        lighting: input.lighting,
        palette: input.palette,
        mood: input.mood,
        copyPosition: input.copyPosition,
        brand,
        styleHint,
        designRef: designRefText,
        referenceDriven: Boolean(designRef),
      });
    } else {
      p = buildFullImagePrompt({
        keyMessage: input.keyMessage,
        concept: input.concept,
        tone: input.tone,
        lighting: input.lighting,
        palette: input.palette,
        mood: input.mood,
        copyPosition: input.copyPosition,
        brand,
        styleHint,
        designRef: designRefText,
        referenceDriven: Boolean(designRef),
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
      const usageContext = {
        operation: refImage ? "single_image_ref_gen" : "single_image_gen",
        brandId: input.brandId ?? null,
        metadata: { generationId, i, mode, refStrength: refStrength ?? "none" },
      };

      const renderBase = (correction = "") => {
        const finalPrompt = `${prompt}${refImage ? referenceGuard(
          refStrength as Exclude<ReferenceStrength, "mood">,
          mode === "full" && hasText,
        ) : ""}${correction}`;
        return refImage
          ? editImage({
              prompt: finalPrompt,
              baseImage: refImage,
              aspectRatio,
              imageSize: "1K",
              usageContext,
            })
          : generateImage({ prompt: finalPrompt, aspectRatio, imageSize: "1K", usageContext });
      };

      // 1) 베이스 이미지. 구조화 텍스트 박스가 있으면 실제 픽셀의 피사체 침범을 검사하고 1회 교정한다.
      let base = await renderBase();
      let checkedBg: Buffer | null = null;
      let zoneRetry = false;
      if (mode === "overlay" && designRef?.textLayers?.length) {
        const activeLayers = designRef.textLayers.filter((layer) =>
          layer.role === "headline" || layer.role === "price" || layer.role === "sub",
        );
        checkedBg = await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
        const violations = await findBusyCopyZones(checkedBg, activeLayers);
        if (violations.length) {
          base = await renderBase(copyZoneCorrection(violations));
          checkedBg = await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
          zoneRetry = true;
          const remaining = await findBusyCopyZones(checkedBg, activeLayers);
          if (remaining.length) {
            throw new Error(`텍스트 안전영역 품질 검사 실패: ${remaining.map((v) => v.role).join(", ")}`);
          }
        }
      }

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
        refStrength: refStrength ?? "none",
        zoneRetry,
      };

      // 2) overlay면 배경을 채널 픽셀로 맞춰 보존(재합성용) 후 한글/로고/CTA 오버레이.
      if (mode === "overlay" && hasText) {
        const bgBuf = checkedBg ?? await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
        // 오버레이는 그라데이션+스크림으로 배경이 어두워지므로 darken을 반영해 로고 대비를 판단.
        const placement = await planLogoPlacement(bgBuf, logoAssets, { darken: 0.55 });
        const config = singleAdConfig({
          headline: input.headline,
          sub: input.sub,
          cta: input.cta,
          logo: logoForCompositor(placement),
          brandColor: brand.ctaColor,
          copyPosition: input.copyPosition,
          // 레퍼런스 타이포 카테고리가 있으면 그 폰트로(없으면 Pretendard).
          fontSet: designRef ? fontSetForReference(designRef) : null,
          typography: designRef?.typography ?? null,
          textLayers: designRef?.textLayers ?? null,
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
          copyPosition: input.copyPosition ?? null,
          fontCategory: designRef?.fontCategory ?? null,
          fontFamily: designRef?.fontFamily ?? null,
          typography: designRef?.typography ?? null,
          textLayers: designRef?.textLayers ?? null,
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

      // full: 텍스트가 이미지에 베이킹됨(재합성 불가). 비율이 맞을 때만 스케일(crop 금지 — 잘림 방지).
      let finalBuf = await resizeToChannel(
        Buffer.from(base.base64, "base64"),
        aspectRatio,
        { allowCrop: false },
      );
      // 로고는 모델에 굽지 않고 여기서 1개만 오버레이(어둠 처리 없이 로고만). 배경 대비로 모서리·에셋 선택.
      const fullPlacement = await planLogoPlacement(finalBuf, logoAssets);
      const fullLogo = logoForCompositor(fullPlacement);
      // full도 CTA는 굽지 않고 후합성(브랜드색·또렷한 버튼). 로고도 함께(스크림 없이 — 베이킹 디자인 보존).
      if (fullLogo || input.cta) {
        finalBuf = await renderComposite(
          finalBuf,
          fullHybridConfig({ cta: input.cta, logo: fullLogo, brandColor: brand.ctaColor }),
        );
        if (fullLogo)
          meta.logo = {
            url: fullPlacement?.url ?? null,
            position: fullPlacement?.position ?? null,
            backing: fullPlacement?.backingColor ?? null,
          };
        if (input.cta) meta.cta = input.cta;
      }
      const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, {
        mimeType: "image/png",
        base64: finalBuf.toString("base64"),
      });
      return {
        label,
        url: uploaded.url,
        path: uploaded.path,
        mode: "full",
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
      copyPosition?: CopyPosition | null;
      fontCategory?: ReferenceFontCategory | null;
      fontFamily?: DesignReference["fontFamily"] | null;
      typography?: DesignReference["typography"] | null;
      textLayers?: DesignReference["textLayers"] | null;
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
    // 생성 시 카피 위치를 그대로 재현(텍스트존 일치).
    copyPosition: compose.copyPosition ?? null,
    // 생성 시 폰트(레퍼런스 타이포)도 그대로 재현.
    fontSet: compose.fontFamily || compose.fontCategory
      ? fontSetForReference({
          fontFamily: compose.fontFamily ?? undefined,
          fontCategory: compose.fontCategory ?? undefined,
        })
      : null,
    typography: compose.typography ?? null,
    textLayers: compose.textLayers ?? null,
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
