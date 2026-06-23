import path from "node:path";
import type { ComposeConfig, ComposeFontSet } from "@/lib/canvas/compositor";
import type { BundleConcept, SlideDetail } from "./types";

// 공통(shared) 배경 — 텍스트·로고 없음. 전 슬라이드 1장 재사용 → 템플릿 일관성.
export const SHARED_BG_PROMPT = `Design a CLEAN, TEXTLESS BACKGROUND for a Korean informational card-news carousel (1:1, 1080x1080). Output must contain NO text, letters, numbers, or logo. Calm, modern, trustworthy: deep navy-to-charcoal soft gradient with subtle geometric lines, generous quiet center area for overlaid Korean text. Sober and clean, not flashy. No people, no objects.`;

// per-slide 배경 — 슬라이드 모티프 반영 + 공통 스타일 프리픽스로 일관성 유지.
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

// 한글 렌더 안정성 우선 — Pretendard 고정(public/fonts).
export function carouselFontSet(): ComposeFontSet {
  const P = path.join(process.cwd(), "public", "fonts", "pretendard");
  return {
    headline: { family: "Pretendard-Bold", fsPath: path.join(P, "Pretendard-Bold.woff2") },
    sub: { family: "Pretendard-Medium", fsPath: path.join(P, "Pretendard-Medium.woff2") },
    cta: { family: "Pretendard-SemiBold", fsPath: path.join(P, "Pretendard-SemiBold.woff2") },
    brand: { family: "Pretendard-SemiBold", fsPath: path.join(P, "Pretendard-SemiBold.woff2") },
    slogan: { family: "Pretendard-Medium", fsPath: path.join(P, "Pretendard-Medium.woff2") },
  };
}

// 슬라이드 역할별 레이아웃 → ComposeConfig (fontSet/배경은 호출자가 채움).
export function slideConfig(
  slide: Pick<SlideDetail, "index" | "role" | "kicker" | "headline" | "body">,
  total: number,
): Omit<ComposeConfig, "backgroundImageUrl" | "output" | "fontSet"> {
  const base: Omit<ComposeConfig, "backgroundImageUrl" | "output" | "fontSet"> = {
    overlay: { top: true, topOpacity: 140, bottom: true, bottomOpacity: 205 },
    slogan: {
      text: `${String(slide.index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      color: "#C9CDD6",
      sizeRatio: 0.02,
      yRatio: 0.95,
    },
  };
  if (slide.kicker) {
    base.brand = {
      text: slide.kicker,
      color: "#E7E9EE",
      sizeRatio: 0.026,
      xRatio: 0.08,
      yRatio: 0.12,
    };
  }
  if (slide.role === "hook") {
    base.mainCopy = {
      text: slide.headline,
      color: "#FFFFFF",
      sizeRatio: 0.082,
      yRatio: 0.44,
      center: true,
      autoFit: true,
      maxLines: 3,
      maxWidthRatio: 0.84,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: "#D1D5DB",
        sizeRatio: 0.03,
        yRatio: 0.66,
        center: true,
        autoFit: true,
        maxLines: 2,
        maxWidthRatio: 0.82,
      };
  } else if (slide.role === "cta") {
    base.mainCopy = {
      text: slide.headline,
      color: "#FFFFFF",
      sizeRatio: 0.064,
      yRatio: 0.4,
      center: true,
      autoFit: true,
      maxLines: 3,
      maxWidthRatio: 0.84,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: "#D1D5DB",
        sizeRatio: 0.03,
        yRatio: 0.6,
        center: true,
        autoFit: true,
        maxLines: 2,
        maxWidthRatio: 0.82,
      };
    base.cta = {
      text: "자세히 보기 ▶",
      bgColor: "#2563EB",
      textColor: "#FFFFFF",
      sizeRatio: 0.028,
      yRatio: 0.78,
      autoFit: true,
      maxWidthRatio: 0.7,
    };
  } else {
    base.mainCopy = {
      text: slide.headline,
      color: "#FFFFFF",
      sizeRatio: 0.058,
      yRatio: 0.3,
      center: true,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: 0.84,
    };
    if (slide.body)
      base.subCopy = {
        text: slide.body,
        color: "#D1D5DB",
        sizeRatio: 0.032,
        yRatio: 0.5,
        center: true,
        autoFit: true,
        maxLines: 4,
        maxWidthRatio: 0.82,
      };
  }
  return base;
}
