import type { ComposeConfig } from "@/lib/canvas/compositor";
import type { CarouselStyle } from "./style";
import type { BundleConcept, SlideDetail } from "./types";

// 공통(shared) 배경 폴백 — 텍스트·로고 없음. 아트디렉터 실패 시에만 사용.
export const SHARED_BG_PROMPT = `Design a CLEAN, TEXTLESS BACKGROUND for a Korean informational card-news carousel (1:1, 1080x1080). Output must contain NO text, letters, numbers, or logo. Calm, modern, trustworthy: deep navy-to-charcoal soft gradient with subtle geometric lines, generous quiet center area for overlaid Korean text. Sober and clean, not flashy. No people, no objects.`;

// per-slide 배경 폴백 — 슬라이드 모티프 반영 + 공통 스타일 프리픽스로 일관성 유지.
export function perSlideBgPrompt(
  concept: BundleConcept | null,
  slide: SlideDetail,
): string {
  const styleLock =
    "Consistent carousel style: deep navy-to-charcoal soft gradient palette, calm modern tone, subtle geometric accents, generous quiet area for overlaid Korean text.";
  const motif = slide.visual?.motif?.trim();
  const idea = concept?.bigIdea?.trim();
  return [
    "Design a CLEAN, TEXTLESS BACKGROUND image (1:1) for one slide of a Korean card-news carousel.",
    "The image MUST contain NO text, letters, numbers, words, or logos.",
    idea ? `Carousel concept: ${idea}.` : null,
    motif ? `This slide's visual motif: ${motif}.` : null,
    styleLock,
    "No people, no readable objects with text.",
  ]
    .filter(Boolean)
    .join(" ");
}

// full 모드 폴백 — 아트디렉터 실패 시 텍스트까지 구운 슬라이드를 직접 지시.
export function fullSlideFallbackPrompt(
  concept: BundleConcept | null,
  slide: Pick<SlideDetail, "kicker" | "headline" | "body" | "visual">,
): string {
  const motif = slide.visual?.motif?.trim();
  const idea = concept?.bigIdea?.trim();
  return [
    "Design ONE complete, polished Korean Instagram card-news slide (1:1, 1080x1080) — background, layout, and typeset Korean text together, like a professional graphic designer.",
    "RENDER the EXACT Korean text below with PERFECT modern Hangul (never distort, misspell, translate, or invent characters; add no extra text):",
    slide.kicker ? `small kicker label "${slide.kicker}"` : null,
    `bold dominant headline "${slide.headline}"`,
    slide.body ? `supporting body text "${slide.body}"` : null,
    idea ? `Theme: ${idea}.` : null,
    motif ? `Scene/subject: ${motif}.` : null,
    "Strong typographic hierarchy, real editorial grid, generous whitespace, high text contrast, premium advertising quality. No logos or wordmarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

// 슬라이드 역할별 레이아웃 → ComposeConfig (fontSet/배경은 호출자가 채움).
// 색·오버레이·정렬·폰트 계열은 CarouselStyle(템플릿 또는 레퍼런스)이 구동.
export function slideConfig(
  slide: Pick<SlideDetail, "index" | "role" | "kicker" | "headline" | "body">,
  total: number,
  style: CarouselStyle,
): Omit<ComposeConfig, "backgroundImageUrl" | "output" | "fontSet"> {
  const c = style.colors;
  const centered = style.align !== "left";
  // textScheme이 오버레이 tint·stroke의 단일 소스.
  // 밝은 글자 → 어두운 오버레이 + 어두운 stroke / 어두운 글자 → 밝은 오버레이 + 흰 stroke.
  // stroke는 오버레이가 닿지 않는 중앙 밴드에서도 글자별 가독성을 보장(항상 적용).
  const lightText = style.textScheme === "light";
  const stroke = true;
  const strokeColor = lightText ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.72)";
  const base: Omit<ComposeConfig, "backgroundImageUrl" | "output" | "fontSet"> = {
    overlay: {
      top: true,
      topOpacity: style.overlay.topOpacity,
      bottom: true,
      bottomOpacity: style.overlay.bottomOpacity,
      tint: lightText ? "dark" : "light",
    },
    slogan: {
      text: `${String(slide.index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      color: c.slogan,
      sizeRatio: 0.02,
      yRatio: 0.95,
    },
  };
  if (slide.kicker) {
    base.brand = {
      text: slide.kicker,
      color: c.kicker,
      sizeRatio: 0.026,
      xRatio: 0.08,
      yRatio: 0.12,
    };
  }
  if (slide.role === "hook") {
    base.mainCopy = {
      text: slide.headline,
      color: c.headline,
      sizeRatio: 0.082,
      yRatio: 0.44,
      center: centered,
      autoFit: true,
      maxLines: 3,
      maxWidthRatio: 0.84,
      stroke,
      strokeColor,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: c.body,
        sizeRatio: 0.03,
        yRatio: 0.66,
        center: centered,
        autoFit: true,
        maxLines: 2,
        maxWidthRatio: 0.82,
        stroke,
        strokeColor,
      };
  } else if (slide.role === "cta") {
    base.mainCopy = {
      text: slide.headline,
      color: c.headline,
      sizeRatio: 0.064,
      yRatio: 0.4,
      center: centered,
      autoFit: true,
      maxLines: 3,
      maxWidthRatio: 0.84,
      stroke,
      strokeColor,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: c.body,
        sizeRatio: 0.03,
        yRatio: 0.6,
        center: centered,
        autoFit: true,
        maxLines: 2,
        maxWidthRatio: 0.82,
        stroke,
        strokeColor,
      };
    base.cta = {
      text: "자세히 보기 ▶",
      bgColor: c.ctaBg,
      textColor: c.ctaText,
      sizeRatio: 0.028,
      yRatio: 0.78,
      autoFit: true,
      maxWidthRatio: 0.7,
    };
  } else {
    base.mainCopy = {
      text: slide.headline,
      color: c.headline,
      sizeRatio: 0.058,
      yRatio: 0.3,
      center: centered,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: 0.84,
      stroke,
      strokeColor,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: c.body,
        sizeRatio: 0.032,
        yRatio: 0.5,
        center: centered,
        autoFit: true,
        maxLines: 4,
        maxWidthRatio: 0.82,
        stroke,
        strokeColor,
      };
  }
  return base;
}
