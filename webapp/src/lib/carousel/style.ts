import path from "node:path";
import type { ComposeFontSet } from "@/lib/canvas/compositor";
import type {
  DesignReference,
  ReferenceFontCategory,
} from "@/lib/generate/types";
import type { CarouselTemplate } from "./templates";

// 슬라이드 합성에 필요한 해석된 스타일(템플릿 또는 레퍼런스에서 도출).
export interface CarouselStyle {
  colors: {
    headline: string;
    body: string;
    kicker: string;
    slogan: string;
    ctaBg: string;
    ctaText: string;
  };
  overlay: { topOpacity: number; bottomOpacity: number };
  align: "center" | "left";
  fontSet: ComposeFontSet;
  /**
   * 오버레이 텍스트 색 계열. light=밝은 글자(어두운 배경), dark=어두운 글자(밝은 배경).
   * 오버레이 tint·stroke 색은 이 값에서 파생(단일 소스 — slideConfig 참고).
   */
  textScheme: "light" | "dark";
}

// ── 폰트 세트(설치 폰트) ───────────────────────────────────────
const FONT_ROOT = path.join(process.cwd(), "public", "fonts");
function fe(dir: string, file: string, family: string) {
  return { family, fsPath: path.join(FONT_ROOT, dir, file) };
}

// 모든 한글 폰트는 한글 글리프 완비 → 매핑 안전. 역할별 굵기만 가용 범위에서 배치.
const FONT_SETS: Record<ReferenceFontCategory, ComposeFontSet> = {
  sans: {
    headline: fe("pretendard", "Pretendard-Bold.woff2", "Pretendard-Bold"),
    sub: fe("pretendard", "Pretendard-Medium.woff2", "Pretendard-Medium"),
    cta: fe("pretendard", "Pretendard-SemiBold.woff2", "Pretendard-SemiBold"),
    brand: fe("pretendard", "Pretendard-SemiBold.woff2", "Pretendard-SemiBold"),
    slogan: fe("pretendard", "Pretendard-Medium.woff2", "Pretendard-Medium"),
  },
  serif: {
    headline: fe("nanum-myeongjo", "NanumMyeongjo-ExtraBold.woff2", "NanumMyeongjo-ExtraBold"),
    sub: fe("nanum-myeongjo", "NanumMyeongjo-Regular.woff2", "NanumMyeongjo-Regular"),
    cta: fe("nanum-myeongjo", "NanumMyeongjo-Bold.woff2", "NanumMyeongjo-Bold"),
    brand: fe("nanum-myeongjo", "NanumMyeongjo-Bold.woff2", "NanumMyeongjo-Bold"),
    slogan: fe("nanum-myeongjo", "NanumMyeongjo-Regular.woff2", "NanumMyeongjo-Regular"),
  },
  rounded: {
    headline: fe("nanum-square-round", "NanumSquareRound-ExtraBold.woff2", "NanumSquareRound-ExtraBold"),
    sub: fe("nanum-square-round", "NanumSquareRound-Regular.woff2", "NanumSquareRound-Regular"),
    cta: fe("nanum-square-round", "NanumSquareRound-Bold.woff2", "NanumSquareRound-Bold"),
    brand: fe("nanum-square-round", "NanumSquareRound-Bold.woff2", "NanumSquareRound-Bold"),
    slogan: fe("nanum-square-round", "NanumSquareRound-Regular.woff2", "NanumSquareRound-Regular"),
  },
  display: {
    headline: fe("gmarket-sans", "GmarketSans-Bold.woff2", "GmarketSans-Bold"),
    sub: fe("gmarket-sans", "GmarketSans-Medium.woff2", "GmarketSans-Medium"),
    cta: fe("gmarket-sans", "GmarketSans-Bold.woff2", "GmarketSans-Bold"),
    brand: fe("gmarket-sans", "GmarketSans-Bold.woff2", "GmarketSans-Bold"),
    slogan: fe("gmarket-sans", "GmarketSans-Light.woff2", "GmarketSans-Light"),
  },
  handwriting: {
    headline: fe("nanum-barunpen", "NanumBarunpen-Bold.woff2", "NanumBarunpen-Bold"),
    sub: fe("nanum-barunpen", "NanumBarunpen-Regular.woff2", "NanumBarunpen-Regular"),
    cta: fe("nanum-barunpen", "NanumBarunpen-Bold.woff2", "NanumBarunpen-Bold"),
    brand: fe("nanum-barunpen", "NanumBarunpen-Bold.woff2", "NanumBarunpen-Bold"),
    slogan: fe("nanum-barunpen", "NanumBarunpen-Regular.woff2", "NanumBarunpen-Regular"),
  },
};

export function fontSetForCategory(cat?: ReferenceFontCategory | null): ComposeFontSet {
  return FONT_SETS[cat ?? "sans"] ?? FONT_SETS.sans;
}

// ── 색 유틸 ────────────────────────────────────────────────────
function hexToRgb(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(s)) {
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-f]{3}$/i.test(s)) {
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  return null;
}

// 상대 휘도(0~1, 단순 가중 평균 — 스킴 판정용으로 충분).
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function contrastText(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#FFFFFF";
  return luminance(rgb.r, rgb.g, rgb.b) > 0.55 ? "#1A1A1A" : "#FFFFFF";
}

/** 팔레트에서 가장 또렷한(채도 높고 중간 명도) 색을 악센트로. 없으면 기본 블루. */
function pickAccent(palette: string[]): string {
  let best: { hex: string; score: number } | null = null;
  for (const c of palette) {
    const rgb = hexToRgb(c);
    if (!rgb) continue;
    const { r, g, b } = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = luminance(r, g, b);
    const score = sat * (1 - Math.abs(lum - 0.5) * 1.1);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (!best || score > best.score) best = { hex, score };
  }
  return best?.hex ?? "#2563EB";
}

/** 팔레트 평균 휘도(파싱 가능한 hex만). 없으면 어두운 쪽 기본값. */
function avgLuminance(palette: string[]): number {
  const lums = palette
    .map(hexToRgb)
    .filter((v): v is { r: number; g: number; b: number } => v != null)
    .map(({ r, g, b }) => luminance(r, g, b));
  if (!lums.length) return 0.22;
  return lums.reduce((a, b) => a + b, 0) / lums.length;
}

// ── 도출 ───────────────────────────────────────────────────────
export function templateToStyle(template: CarouselTemplate): CarouselStyle {
  return {
    colors: template.colors,
    overlay: {
      topOpacity: template.overlay.topOpacity,
      bottomOpacity: template.overlay.bottomOpacity,
    },
    align: template.align,
    fontSet: fontSetForCategory("sans"),
    textScheme: "light",
  };
}
// (참고) overlay.tint·stroke 색은 CarouselStyle.textScheme에서 slideConfig가 파생한다.

/** 레퍼런스 디자인 요소 → 스타일(배경 명도로 라이트/다크 스킴, 악센트·폰트 도출). */
export function deriveReferenceStyle(ref: DesignReference): CarouselStyle {
  const accent = pickAccent(ref.palette ?? []);
  const lightText = avgLuminance(ref.palette ?? []) < 0.5; // 어두운 배경 → 밝은 글자
  const fontSet = fontSetForCategory(ref.fontCategory);

  if (lightText) {
    return {
      colors: {
        headline: "#FFFFFF",
        body: "#E5E7EB",
        kicker: accent,
        slogan: "#C9CDD6",
        ctaBg: accent,
        ctaText: contrastText(accent),
      },
      overlay: { topOpacity: 140, bottomOpacity: 205 },
      align: "center",
      fontSet,
      textScheme: "light",
    };
  }
  // 밝은 레퍼런스 → 어두운 글자 + 밝은(흰색) 오버레이로 텍스트 영역을 띄움.
  return {
    colors: {
      headline: "#1A1A1A",
      body: "#374151",
      kicker: accent,
      slogan: "#6B7280",
      ctaBg: accent,
      ctaText: contrastText(accent),
    },
    overlay: { topOpacity: 120, bottomOpacity: 190 },
    align: "center",
    fontSet,
    textScheme: "dark",
  };
}

/** 레퍼런스가 있으면 레퍼런스가 색·폰트 주도, 없으면 템플릿. */
export function resolveStyle(opts: {
  designRef?: DesignReference | null;
  template: CarouselTemplate;
}): CarouselStyle {
  return opts.designRef
    ? deriveReferenceStyle(opts.designRef)
    : templateToStyle(opts.template);
}
