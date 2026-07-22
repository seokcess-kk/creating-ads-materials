import path from "node:path";
import type { ComposeConfig, ComposeFontSet, ComposeTextLayer, LogoPosition } from "@/lib/canvas/compositor";
import type { CopyPosition, ReferenceTextLayer, ReferenceTypographyProfile } from "./types";

// 카피 위치별 텍스트존 세로 위치(yRatio). 그라데이션/스크림은 전 영역 대비를 확보하므로
// 위치만 이동해도 가독성이 유지된다. center가 현행 기본값.
const COPY_Y: Record<CopyPosition, { headline: number; sub: number; cta: number }> = {
  top: { headline: 0.16, sub: 0.3, cta: 0.44 },
  center: { headline: 0.4, sub: 0.62, cta: 0.82 },
  bottom: { headline: 0.56, sub: 0.72, cta: 0.86 },
};

// 한글 렌더 안정성 우선 — Pretendard 고정(public/fonts). 단일 이미지/캐러셀 공통 정책.
export function singleAdFontSet(): ComposeFontSet {
  const P = path.join(process.cwd(), "public", "fonts", "pretendard");
  return {
    headline: { family: "Pretendard-Bold", fsPath: path.join(P, "Pretendard-Bold.woff2") },
    sub: { family: "Pretendard-Medium", fsPath: path.join(P, "Pretendard-Medium.woff2") },
    cta: { family: "Pretendard-SemiBold", fsPath: path.join(P, "Pretendard-SemiBold.woff2") },
    brand: { family: "Pretendard-SemiBold", fsPath: path.join(P, "Pretendard-SemiBold.woff2") },
    slogan: { family: "Pretendard-Medium", fsPath: path.join(P, "Pretendard-Medium.woff2") },
  };
}

export interface SingleAdLogo {
  /** 로고 바이트(생성 경로 — fetch 회피). buffer 우선, 없으면 url. */
  buffer?: Buffer | Uint8Array;
  /** 로고 URL(재합성 경로 등 buffer가 없을 때 fetch) */
  url?: string;
  position?: LogoPosition;
  /** 가독성 패널 색(없으면 미사용) */
  backingColor?: string | null;
}

export interface SingleAdLayoutInput {
  headline?: string | null;
  sub?: string | null;
  cta?: string | null;
  /** 배경 대비에 맞춰 선택·배치된 로고(없으면 로고 미표시) */
  logo?: SingleAdLogo | null;
  /** CTA 버튼 배경(브랜드 primary) */
  brandColor?: string | null;
  /** 카피 세로 위치(없으면 center) */
  copyPosition?: CopyPosition | null;
  /** 폰트 세트 오버라이드(레퍼런스 타이포 매핑). 없으면 Pretendard. */
  fontSet?: ComposeFontSet | null;
  /** 레퍼런스에서 측정한 타이포 비례/배치. copyPosition보다 우선한다. */
  typography?: ReferenceTypographyProfile | null;
  textLayers?: ReferenceTextLayer[] | null;
  /** 품질 게이트 재시도 후에도 배경 디테일이 남은 역할 — 국소 대비 처리만 적용한다. */
  busyTextRoles?: ReferenceTextLayer["role"][] | null;
}

const PRICE_TOKEN = /(?:(?:개당|단|월|총)\s*)?(?:\d[\d,.]*\s*(?:억|천|백|십|만)?\s*원(?:부터)?|\d[\d,.]*\s*%|무료)/i;

function contrastStroke(color: string): string {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return "rgba(0,0,0,0.68)";
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 145
    ? "rgba(0,0,0,0.68)"
    : "rgba(255,255,255,0.72)";
}

function layerWeight(weight: ReferenceTextLayer["weight"]): ComposeTextLayer["fontWeight"] {
  return weight === "black" ? "900" : weight === "regular" ? "normal" : weight === "medium" ? "500" : "bold";
}

/** 새 카피를 레퍼런스의 의미 레이어에 배치한다. 원본 문구나 없는 고지는 발명하지 않는다. */
export function buildReferenceTextLayers(input: {
  headline?: string | null;
  sub?: string | null;
  layers?: ReferenceTextLayer[] | null;
  busyRoles?: ReferenceTextLayer["role"][] | null;
}): ComposeTextLayer[] {
  if (!input.layers?.length) return [];
  let headline = input.headline?.trim() ?? "";
  let sub = input.sub?.trim() ?? "";
  const priceMatch = headline.match(PRICE_TOKEN) ?? sub.match(PRICE_TOKEN);
  const price = priceMatch?.[0]?.replace(/\s+/g, "") ?? "";
  if (price && headline.includes(priceMatch?.[0] ?? "")) headline = headline.replace(priceMatch?.[0] ?? "", "").trim();
  else if (price && sub.includes(priceMatch?.[0] ?? "")) sub = sub.replace(priceMatch?.[0] ?? "", "").trim();
  headline = headline.replace(/[·|,/-]+\s*$/, "").trim();
  sub = sub.replace(/[·|,/-]+\s*$/, "").trim();

  const used = new Set<string>();
  const result = input.layers.flatMap((layer): ComposeTextLayer[] => {
    let text = "";
    if (layer.role === "headline" && !used.has("headline")) text = headline || input.headline?.trim() || "";
    else if (layer.role === "price" && !used.has("price")) text = price;
    else if (layer.role === "sub" && !used.has("sub")) text = sub;
    if (!text) return [];
    used.add(layer.role);
    return [{
      text,
      xRatio: layer.xRatio,
      yRatio: layer.yRatio,
      widthRatio: layer.widthRatio,
      sizeRatio: layer.sizeRatio,
      lineHeight: layer.lineHeight,
      align: layer.align,
      color: layer.color,
      gradientEndColor: layer.gradientEndColor,
      fontWeight: layerWeight(layer.weight),
      fontRole: layer.role === "sub" ? "sub" : "headline",
      maxLines: layer.maxLines,
      minScale: layer.role === "headline" ? 0.6 : 0.68,
      strokeColor: layer.strokeColor
        ?? (input.busyRoles?.includes(layer.role) ? contrastStroke(layer.color) : undefined),
      backgroundColor: layer.backgroundColor,
      cornerRadiusRatio: layer.cornerRadiusRatio,
    }];
  });
  const complete = (!headline || used.has("headline"))
    && (!price || used.has("price"))
    && (!sub || used.has("sub"));
  return complete ? result : [];
}

/** 이미지 모델 호출 전에 레퍼런스 텍스트 박스와 새 카피 길이의 명백한 충돌을 차단한다. */
export function assertCopyFitsTypography(
  input: Pick<SingleAdLayoutInput, "headline" | "sub" | "typography">,
): void {
  const t = input.typography;
  if (!t) return;
  const count = (value?: string | null) => Array.from(value?.replace(/\s/g, "") ?? "").length;
  // 한글 정방형 글리프 폭을 약 0.9em으로 잡은 보수적 사전 검사. 실제 측정은 compositor가 수행한다.
  const headlinePerLine = Math.max(4, Math.floor(t.headlineMaxWidthRatio / (t.headlineSizeRatio * 0.9)));
  const headlineLimit = headlinePerLine * 2;
  if (count(input.headline) > headlineLimit) {
    throw new Error(`헤드라인이 레퍼런스 영역보다 깁니다. 공백 제외 ${headlineLimit}자 이내로 줄여 주세요.`);
  }
  if (input.sub && t.subSizeRatio && t.subMaxWidthRatio) {
    const subPerLine = Math.max(6, Math.floor(t.subMaxWidthRatio / (t.subSizeRatio * 0.9)));
    const subLimit = subPerLine * 2;
    if (count(input.sub) > subLimit) {
      throw new Error(`보조 문구가 레퍼런스 영역보다 깁니다. 공백 제외 ${subLimit}자 이내로 줄여 주세요.`);
    }
  }
}

// 텍스트 오버레이 레이아웃 → ComposeConfig. backgroundImageUrl/output은 renderComposite가 무시(호환용 빈값).
export function singleAdConfig(input: SingleAdLayoutInput): ComposeConfig {
  const Y = COPY_Y[input.copyPosition ?? "center"];
  const t = input.typography;
  const align = t?.alignment ?? "center";
  const xRatio = align === "center" ? 0.5 : align === "right" ? 0.95 : 0.05;
  const fontWeight = t?.headlineWeight === "black"
    ? "900"
    : t?.headlineWeight === "regular"
      ? "normal"
      : t?.headlineWeight === "medium"
        ? "500"
        : "bold";
  const structuredLayers = buildReferenceTextLayers({
    headline: input.headline,
    sub: input.sub,
    layers: input.textLayers,
    busyRoles: input.busyTextRoles,
  });
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: input.fontSet ?? singleAdFontSet(),
    // AI 배경은 어디든 밝을 수 있어 상/하 그라데이션 + 은은한 전체 스크림으로
    // 임의 배경에서도 텍스트 가독성을 확보한다(히어로 텍스트는 외곽선 추가).
    overlay: structuredLayers.length
      ? { top: false, bottom: false }
      : { top: true, topOpacity: 150, bottom: true, bottomOpacity: 225, scrim: 48 },
    textLayers: structuredLayers,
  };

  if (input.logo?.buffer || input.logo?.url) {
    config.logo = {
      buffer: input.logo.buffer,
      url: input.logo.url,
      position: input.logo.position ?? "top-left",
      widthRatio: 0.16,
      marginRatio: 0.05,
      backingColor: input.logo.backingColor ?? null,
    };
  }

  if (input.headline && structuredLayers.length === 0) {
    config.mainCopy = {
      text: input.headline,
      color: t?.headlineColor ?? "#FFFFFF",
      sizeRatio: t?.headlineSizeRatio ?? 0.078,
      yRatio: t?.headlineYRatio ?? Y.headline,
      align,
      xRatio,
      fontWeight,
      lineSpacingRatio: t ? t.headlineSizeRatio * t.headlineLineHeight : undefined,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: t?.headlineMaxWidthRatio ?? 0.86,
      minScale: 0.75,
      stroke: t?.hasStrokeOrShadow ?? true,
    };
  }

  if (input.sub && structuredLayers.length === 0) {
    config.subCopy = {
      text: input.sub,
      color: t?.subColor ?? "#FFFFFF",
      sizeRatio: t?.subSizeRatio ?? 0.032,
      yRatio: t?.subYRatio ?? Y.sub,
      align,
      xRatio,
      fontWeight: "normal",
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: t?.subMaxWidthRatio ?? 0.82,
      minScale: 0.75,
      stroke: t?.hasStrokeOrShadow ?? true,
    };
  }

  if (input.cta) {
    config.cta = {
      text: input.cta,
      bgColor: input.brandColor ?? "#2563EB",
      textColor: "#FFFFFF",
      sizeRatio: 0.03,
      yRatio: Y.cta,
      autoFit: true,
      maxWidthRatio: 0.7,
    };
  }

  return config;
}

// full/edit 모드용 경량 후합성 — 베이킹된 디자인 위에 '굽지 않는' 정밀 요소(CTA 버튼·로고)만
// 스크림 없이 올린다(그라데이션/스크림은 베이킹된 글자를 덮으므로 미사용). CTA는 자체 배경색으로 가독.
export function fullHybridConfig(input: {
  cta?: string | null;
  logo?: SingleAdLogo | null;
  brandColor?: string | null;
}): ComposeConfig {
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: singleAdFontSet(),
    overlay: { top: false, bottom: false },
  };
  if (input.logo?.buffer || input.logo?.url) {
    config.logo = {
      buffer: input.logo.buffer,
      url: input.logo.url,
      position: input.logo.position ?? "top-left",
      widthRatio: 0.16,
      marginRatio: 0.05,
      backingColor: input.logo.backingColor ?? null,
    };
  }
  if (input.cta) {
    config.cta = {
      text: input.cta,
      bgColor: input.brandColor ?? "#2563EB",
      textColor: "#FFFFFF",
      sizeRatio: 0.03,
      yRatio: 0.86,
      autoFit: true,
      maxWidthRatio: 0.7,
    };
  }
  return config;
}
