import sharp from "sharp";
import { generateImage, editImage, type AspectRatio, type ImagePart } from "@/lib/engines";
import { renderComposite } from "@/lib/canvas/compositor";
import { nearestAspect, resizeToChannel } from "@/lib/canvas/resize";
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
import { refineLayersFromOriginal } from "./measure-layers";
import { buildImagePrompts, type CreativeBrief } from "./art-director";
import { anyNeedsOverlay } from "@/lib/text/bake-policy";
import {
  copyZoneCorrection,
  findBusyCopyZones,
  findLowContrastLayers,
  type CopyZoneViolation,
} from "./quality";
import {
  verifyBakedImage,
  bakeQaCorrection,
  detectCopiedPerson,
  PERSON_CORRECTION,
} from "./verify-baked";
import type {
  SingleImageInput,
  SingleImageResult,
  GeneratedImageVariant,
  SingleRenderMode,
  ReferenceStrength,
  DesignReference,
  CopyPosition,
  LayerCopy,
  ReferenceFontCategory,
} from "./types";

export const SINGLE_IMAGE_PROMPT_VERSION = "single@0.6.0";

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
// 실존 인물 복제(초상권) 방지 — 모든 픽셀 참조 강도에 공통으로 붙는 하드 가드.
const PERSON_GUARD =
  " If the reference contains any person, do NOT reproduce that person's identity: render a clearly DIFFERENT individual (different face, features and hairstyle) in a similar role and pose, or omit the person if the brief describes no people.";

// 빈 배지·필 컨테이너 방지 — 텍스트·배지 배경은 컴포지터가 실측 좌표에 그린다(이중 소유 금지).
const CONTAINER_GUARD =
  " Where the reference has text, badges, pills, ribbons or stickers, leave those areas as PLAIN, flat background — do NOT draw empty containers, pills, badges, medallions or placeholder shapes there (text and badge backgrounds are composited later at exact coordinates).";

// 배경 구조 보존 — 사진/일러스트 성격과 구역별 색 블록이 단일 톤으로 뭉개지는 것 방지.
const BACKGROUND_GUARD =
  " Preserve the nature of the reference background (photographic stays photographic, illustrated stays illustrated) and keep its distinct color-block regions in place — do not flatten them into one uniform backdrop.";

function referenceGuard(
  strength: Exclude<ReferenceStrength, "mood">,
  rendersText: boolean,
): string {
  if (strength === "layout") {
    return rendersText
      ? `\n\nDESIGN TEMPLATE REFERENCE — TYPOGRAPHY IS A HARD CONSTRAINT: Treat the attached image as a pixel-level design template. Preserve the exact text-block bounding boxes, baselines, alignment, line count, line-height, relative font sizes, weight, width/condensation, tracking, colors, outline/shadow treatment, and whitespace. Match the reference typeface's visible glyph personality as closely as the image model can (serif shape, terminals, stroke contrast, roundness, counters), not merely its broad font category. Render ONLY the new Korean text specified above, fitted into the same boxes without inventing, duplicating, or retaining any reference letters. Preserve the exact layout, grid, element placement, decorative elements, palette, lighting and mood.${BACKGROUND_GUARD} Swap subjects/content only. Do NOT copy reference logos, photos or products.${PERSON_GUARD} Before finalizing, visually compare the new typography against the attached reference and correct any drift in geometry or styling.`
      : `\n\nDESIGN TEMPLATE REFERENCE: The attached image is a design TEMPLATE to follow closely — replicate its exact layout, grid, element placement, decorative elements, color palette, lighting and mood, so the result reads as another version of the same design.${BACKGROUND_GUARD} Swap ONLY the content to the new subject/scene described above, and produce a fully TEXTLESS composition.${CONTAINER_GUARD} Do NOT copy the reference's literal text, logos, photos or products.${PERSON_GUARD}`;
  }
  return rendersText
    ? `\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood, composition and typographic feel so the result reads as designed after it. Build an ENTIRELY NEW image: do NOT copy its subjects, objects, photos, logos, or ANY of its text/letters/numbers.${PERSON_GUARD} Render ONLY the Korean text specified above.`
    : `\n\nSTYLE REFERENCE: The attached image is a STYLE reference ONLY — replicate its exact color palette, lighting, mood and composition. Create an ENTIRELY NEW, fully TEXTLESS composition: do NOT copy its subjects, objects, photos, text, or logos.${PERSON_GUARD}${CONTAINER_GUARD}`;
}

/**
 * 재사용(reuse) 경로의 텍스트 제거 지시 — 레퍼런스 픽셀에서 글자·로고만 지우고
 * 나머지(레이아웃·오브젝트·장식·색·조명)는 픽셀 수준으로 보존한다.
 */
// 컨테이너(필·배지)를 "남기고 채우기"는 모델이 변색·이동시켜 신뢰할 수 없다(실측 검증됨) —
// 텍스트와 그 컨테이너를 함께 지우고, 필·배지는 컴포지터가 실측 좌표·보정 색으로 다시 그린다.
const TEXT_REMOVAL_PROMPT =
  "Remove ALL text from this image, together with the badge/pill/sticker containers that hold text. Specifically remove: " +
  "(1) every letter, word and logo wordmark; (2) ALL numbers including large stylized/decorative numerals — a giant number is text, not decoration; " +
  "(3) every text container: pills, badges, stickers, seals, scalloped shapes, ribbons and speech bubbles, whether filled or empty. " +
  "Fill every removed area by cleanly extending the surrounding background colors and gradients — flat and crisp, never blurred, smudged or hazy. " +
  "KEEP everything else exactly identical: illustrated objects (boxes, products, characters), scene decorations, colors, lighting, layout and composition. " +
  "Lettering printed on a kept object is removed cleanly, leaving the object's plain surface. " +
  "The result must be a completely text-free, badge-free version of the same scene.";

/** 로고 버퍼를 컴포지터에 직접 전달(fetch 없이). 포맷은 sharp가 내용으로 판별. */
function logoForCompositorFrom(
  logoAssets: LogoCandidate[],
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

/** 역할별 카피 병합 — headline/sub 명시값이 layers보다 우선(폼 편집이 최종). */
function mergeLayerCopy(copy: {
  headline?: string | null;
  sub?: string | null;
  layers?: LayerCopy | null;
}): LayerCopy | null {
  const merged: LayerCopy = { ...(copy.layers ?? {}) };
  if (copy.headline?.trim()) merged.headline = copy.headline.trim();
  if (copy.sub?.trim()) merged.sub = copy.sub.trim();
  return Object.values(merged).some((t) => t?.trim()) ? merged : null;
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

  // 레퍼런스 처리 — 강도는 사용자 선택을 그대로 따른다(자동 승격 없음 — 추천은 UI가 제안만).
  const refUrl = input.referenceImageUrl?.trim() || null;
  let refStrength: ReferenceStrength | null = refUrl
    ? (input.referenceStrength ?? "style")
    : null;

  // 실측 textLayers가 없으면(구 분석·프리셋 폴백) 텍스트가 있는 레퍼런스 생성은 정밀 재분석을 시도한다.
  // 분석은 어디까지나 보강 — 실패해도 생성은 계속한다(style/layout이면 픽셀 참조가 본체).
  let designRef: DesignReference | null = input.designRef ?? null;
  const needsLayerAnalysis = Boolean(refUrl && hasText && designRef?.textLayersMeasured !== true);
  if (refUrl && (!designRef || needsLayerAnalysis)) {
    const analyzed = await analyzeReferenceDesign(refUrl, {
      operation: "single_image_ref_analyze",
      brandId: input.brandId ?? null,
      metadata: { generationId, reason: needsLayerAnalysis ? "missing_measured_layers" : "missing_design_ref" },
    });
    // 재분석이 실측을 얻지 못하면 기존(폴백 포함) 요약을 유지한다.
    if (analyzed && (analyzed.textLayersMeasured === true || !designRef)) designRef = analyzed;
  }
  // 실측 레이어만 게이트·기하 주입의 근거가 된다(프리셋 좌표는 합성 배치에만 사용).
  const measuredLayers = designRef?.textLayersMeasured === true ? (designRef.textLayers ?? []) : [];

  // 재사용은 실측 좌표와 카피가 모두 있어야 성립 — 아니면 템플릿 생성(layout)으로 강등.
  if (refStrength === "reuse" && (!measuredLayers.length || !hasText)) {
    refStrength = "layout";
  }
  // 재사용은 항상 후합성(overlay) — 배경을 그대로 쓰므로 베이킹 개념이 없다.
  const mode: SingleRenderMode = refStrength === "reuse" ? "overlay" : decideMode(input);

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

  // ── 재사용(reuse) 경로: 레퍼런스에서 텍스트만 지운 배경 1장 + 카피 변형 N개 재합성 ──
  // 아트디렉터·생성 프롬프트가 필요 없다(장면을 새로 만들지 않음). 모델 호출은 텍스트 제거 1회뿐.
  if (refStrength === "reuse" && refImage && designRef) {
    // 실측 좌표(0~1 비율)가 어긋나지 않게 사용자 비율 대신 레퍼런스 원본 프레이밍에 스냅.
    const refMeta = await sharp(Buffer.from(refImage.base64, "base64")).metadata();
    const reuseAspect = nearestAspect(refMeta.width, refMeta.height) ?? aspectRatio;

    const cleaned = await editImage({
      prompt: TEXT_REMOVAL_PROMPT,
      baseImage: refImage,
      aspectRatio: reuseAspect,
      imageSize: "1K",
      usageContext: {
        operation: "single_image_reuse_clean",
        brandId: input.brandId ?? null,
        metadata: { generationId },
      },
    });
    const bgBuf = await resizeToChannel(Buffer.from(cleaned.base64, "base64"), reuseAspect);

    // 궁극 수정: 좌표·크기·색·줄수는 비전 추정이 아니라 원본 픽셀에서 색 유도로 실측한다.
    // 비전은 의미(역할·컨테이너 여부·대략 위치·색 prior)만 담당. 레이어별 실측 실패 시 비전 유지.
    let reuseLayers = measuredLayers;
    try {
      reuseLayers = await refineLayersFromOriginal(
        Buffer.from(refImage.base64, "base64"),
        measuredLayers,
      );
    } catch (e) {
      console.warn("원본 색 유도 실측 실패(비전 레이어로 폴백):", (e as Error).message);
    }

    // 텍스트 제거 과정에서 존이 밝아졌을 수 있으므로 저대비 역할에 스트로크를 적용한다.
    const reuseBusyRoles = await findLowContrastLayers(bgBuf, reuseLayers);
    const placement = await planLogoPlacement(bgBuf, logoAssets);
    const logo = logoForCompositorFrom(logoAssets, placement);
    const bgUploaded = await uploadGeneratedImage(generationId, "bg_reuse", {
      mimeType: "image/png",
      base64: bgBuf.toString("base64"),
    });

    // 카피 변형 목록(있으면 그것이 후보 수). 광고용이면 CTA는 여기서도 제거.
    const stripCta = (raw.placement ?? "ad") === "ad";
    const copies = (
      input.copyVariants?.length
        ? input.copyVariants
        : [{ headline: input.headline, sub: input.sub, cta: input.cta, layers: input.layerCopy ?? null }]
    )
      .slice(0, 4)
      .map((c) => ({ ...c, cta: stripCta ? null : c.cta }));

    const results = await Promise.allSettled(
      copies.map(async (c, i) => {
        const layerCopy = mergeLayerCopy(c);
        const config = singleAdConfig({
          headline: c.headline,
          sub: c.sub,
          cta: c.cta,
          logo,
          brandColor: brand.ctaColor,
          fontSet: fontSetForReference(designRef),
          typography: designRef.typography ?? null,
          textLayers: reuseLayers,
          layerCopy,
          busyTextRoles: reuseBusyRoles,
        });
        const composed = await renderComposite(bgBuf, config);
        const uploaded = await uploadGeneratedImage(generationId, `v${i + 1}`, {
          mimeType: "image/png",
          base64: composed.toString("base64"),
        });
        const meta: Record<string, unknown> = {
          mode: "overlay",
          label: c.headline?.trim() || `카피 ${i + 1}`,
          promptVersion: SINGLE_IMAGE_PROMPT_VERSION,
          provider: cleaned.provider,
          model: cleaned.model,
          size: cleaned.size ?? null,
          aspectRatio: reuseAspect,
          refStrength: "reuse",
          compose: {
            logoUrl: placement?.url ?? null,
            logoPosition: placement?.position ?? null,
            logoBacking: placement?.backingColor ?? null,
            brandColor: brand.ctaColor,
            copyPosition: null,
            fontCategory: designRef.fontCategory ?? null,
            fontFamily: designRef.fontFamily ?? null,
            typography: designRef.typography ?? null,
            textLayers: reuseLayers,
            layerCopy,
            busyTextRoles: reuseBusyRoles,
            headline: c.headline ?? null,
            sub: c.sub ?? null,
            cta: c.cta ?? null,
          },
        };
        return {
          label: String(meta.label),
          url: uploaded.url,
          path: uploaded.path,
          mode: "overlay",
          bgUrl: bgUploaded.url,
          meta,
        } satisfies GeneratedImageVariant;
      }),
    );
    const variants: GeneratedImageVariant[] = [];
    const failures: Array<{ label: string; reason: string }> = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") variants.push(r.value);
      else failures.push({ label: `카피 ${i + 1}`, reason: (r.reason as Error)?.message ?? "unknown" });
    });
    if (variants.length === 0) {
      throw new Error(
        `재사용 합성 실패 — ${failures.map((f) => `${f.label}: ${f.reason}`).join(" / ")}`,
      );
    }
    return { variants, failures };
  }

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

  const results = await Promise.allSettled(
    Array.from({ length: count }, (_, i) => i).map(async (i) => {
      const prompt = directed?.[i]?.prompt ?? fallbackPrompt(i);
      const label = directed?.[i]?.label || `v${i + 1}`;
      const usageContext = {
        operation: refImage ? "single_image_ref_gen" : "single_image_gen",
        brandId: input.brandId ?? null,
        metadata: { generationId, i, mode, refStrength: refStrength ?? "none" },
      };

      // 카피 없는 실측 역할의 좌표를 명시해 빈 컨테이너를 그 자리에 그리지 않게 한다
      // (일반 지시보다 좌표 명시가 훨씬 잘 듣는다). 가드는 소프트 제약이라 재발 가능 — 최선 노력.
      const filledRoles = new Set(
        Object.entries(
          mergeLayerCopy({ headline: input.headline, sub: input.sub, layers: input.layerCopy ?? null }) ?? {},
        )
          .filter(([, t]) => t?.trim())
          .map(([role]) => role),
      );
      const emptySlots = measuredLayers.filter((l) => !filledRoles.has(l.role));
      const emptySlotGuard = refImage && mode === "overlay" && emptySlots.length
        ? `\n\nEMPTY-SLOT RULE: No copy will be composited at these reference text/badge positions — leave each as PLAIN background with NO container, badge, pill or sticker shape: ${emptySlots
            .map((l) => `${l.role} at (x≈${l.xRatio.toFixed(2)}, y≈${l.yRatio.toFixed(2)})`)
            .join(", ")}.`
        : "";

      const renderBase = (correction = "") => {
        const finalPrompt = `${prompt}${refImage ? referenceGuard(
          refStrength as Exclude<ReferenceStrength, "mood">,
          mode === "full" && hasText,
        ) : ""}${emptySlotGuard}${correction}`;
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

      // 1) 베이스 이미지. 실측 텍스트 박스가 있으면 픽셀의 피사체 침범을 검사하고 1회 교정하되,
      //    교정본이 더 나쁘면 원본을 유지한다(재시도가 항상 낫다는 보장이 없음).
      let base = await renderBase();

      // 1a) 인물 복제 검사(초상권) — 레퍼런스 픽셀 참조 시 생성물의 인물이 레퍼런스와
      //     동일 인물로 보이면 1회 교정 재생성. QA 인프라 실패는 생성을 막지 않는다.
      let personRetry = false;
      if (refImage) {
        const copied = await detectCopiedPerson(
          refImage,
          { base64: base.base64, mimeType: base.mimeType },
          {
            operation: "single_image_person_check",
            brandId: input.brandId ?? null,
            metadata: { generationId, i },
          },
        );
        if (copied) {
          base = await renderBase(PERSON_CORRECTION);
          personRetry = true;
        }
      }
      // 이후 재시도(존 게이트·베이킹 QA)가 인물 교정을 되돌리지 않도록 교정 지시를 누적한다.
      const personFix = personRetry ? PERSON_CORRECTION : "";
      let checkedBg: Buffer | null = null;
      let zoneRetry = false;
      let busyTextRoles: NonNullable<DesignReference["textLayers"]>[number]["role"][] = [];
      if (mode === "overlay" && measuredLayers.length) {
        const activeLayers = measuredLayers.filter((layer) =>
          layer.role === "headline" || layer.role === "price" || layer.role === "sub",
        );
        checkedBg = await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
        const violations = await findBusyCopyZones(checkedBg, activeLayers);
        if (violations.length) {
          const severity = (v: CopyZoneViolation[]) => v.reduce((s, x) => s + x.edgeDensity, 0);
          const retryBase = await renderBase(`${personFix}${copyZoneCorrection(violations)}`);
          const retryBg = await resizeToChannel(Buffer.from(retryBase.base64, "base64"), aspectRatio);
          const remaining = await findBusyCopyZones(retryBg, activeLayers);
          zoneRetry = true;
          if (severity(remaining) <= severity(violations)) {
            base = retryBase;
            checkedBg = retryBg;
            busyTextRoles = [...new Set(remaining.map((v) => v.role))];
          } else {
            busyTextRoles = [...new Set(violations.map((v) => v.role))];
          }
        }
      }

      // 1b) full 모드는 텍스트가 이미지에 구워지므로 결과를 비전 QA로 검증한다(오타·무단 텍스트·로고).
      //     실패 시 교정 재생성 1회 후 문제가 적은 쪽을 채택. QA 인프라 실패는 생성을 막지 않는다.
      let bakeQa: { retried: boolean; issues: unknown } | null = null;
      if (mode === "full") {
        const expected = { headline: input.headline, sub: input.sub };
        const qaContext = {
          operation: "single_image_bake_qa",
          brandId: input.brandId ?? null,
          metadata: { generationId, i },
        };
        const first = await verifyBakedImage(
          { base64: base.base64, mimeType: base.mimeType },
          expected,
          qaContext,
        );
        if (first) {
          bakeQa = { retried: false, issues: first.issues };
          if (!first.ok) {
            const retryBase = await renderBase(`${personFix}${bakeQaCorrection(first.issues)}`);
            const second = await verifyBakedImage(
              { base64: retryBase.base64, mimeType: retryBase.mimeType },
              expected,
              qaContext,
            );
            // 재검증 불가(null)면 교정 지시가 반영된 재생성본을 신뢰한다.
            if (!second || second.issues.length <= first.issues.length) {
              base = retryBase;
              bakeQa = { retried: true, issues: second?.issues ?? null };
            } else {
              bakeQa = { retried: true, issues: first.issues };
            }
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
        personRetry,
        zoneRetry,
        busyTextRoles,
        ...(bakeQa ? { qa: bakeQa } : {}),
      };

      // 2) overlay면 배경을 채널 픽셀로 맞춰 보존(재합성용) 후 한글/로고/CTA 오버레이.
      if (mode === "overlay" && hasText) {
        const bgBuf = checkedBg ?? await resizeToChannel(Buffer.from(base.base64, "base64"), aspectRatio);
        // 대비 게이트 — 배경이 레이어 글자색과 비슷한 밝기로 바뀐 역할('주황-위-주황')에
        // 컴포지터가 대비 스트로크를 적용하도록 busy 역할과 합집합.
        if (measuredLayers.length) {
          const lowContrast = await findLowContrastLayers(bgBuf, measuredLayers);
          busyTextRoles = [...new Set([...busyTextRoles, ...lowContrast])];
        }
        // 오버레이는 그라데이션+스크림으로 배경이 어두워지므로 darken을 반영해 로고 대비를 판단.
        const placement = await planLogoPlacement(bgBuf, logoAssets, { darken: 0.55 });
        const layerCopy = mergeLayerCopy({
          headline: input.headline,
          sub: input.sub,
          layers: input.layerCopy ?? null,
        });
        const config = singleAdConfig({
          headline: input.headline,
          sub: input.sub,
          cta: input.cta,
          logo: logoForCompositorFrom(logoAssets, placement),
          brandColor: brand.ctaColor,
          copyPosition: input.copyPosition,
          // 레퍼런스 타이포 카테고리가 있으면 그 폰트로(없으면 Pretendard).
          fontSet: designRef ? fontSetForReference(designRef) : null,
          typography: designRef?.typography ?? null,
          textLayers: designRef?.textLayers ?? null,
          layerCopy,
          busyTextRoles,
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
          layerCopy,
          busyTextRoles,
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
      const fullLogo = logoForCompositorFrom(logoAssets, fullPlacement);
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
      layerCopy?: LayerCopy | null;
      busyTextRoles?: NonNullable<DesignReference["textLayers"]>[number]["role"][] | null;
    }) ?? {};
  const bgBuf = await fetchAsBuffer(bgUrl);
  // 저장된 역할별 카피 위에 이번 편집(headline/sub)을 덮어 병합 — 나머지 역할(eyebrow·price…)은 보존.
  const layerCopy = mergeLayerCopy({
    headline: input.headline,
    sub: input.sub,
    layers: compose.layerCopy ?? null,
  });
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
    layerCopy,
    busyTextRoles: compose.busyTextRoles ?? null,
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
      layerCopy,
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
