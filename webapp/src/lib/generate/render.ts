import path from "node:path";
import type { ComposeConfig, ComposeFontSet, LogoPosition } from "@/lib/canvas/compositor";
import type { CopyPosition } from "./types";

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
}

// 텍스트 오버레이 레이아웃 → ComposeConfig. backgroundImageUrl/output은 renderComposite가 무시(호환용 빈값).
export function singleAdConfig(input: SingleAdLayoutInput): ComposeConfig {
  const Y = COPY_Y[input.copyPosition ?? "center"];
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: singleAdFontSet(),
    // AI 배경은 어디든 밝을 수 있어 상/하 그라데이션 + 은은한 전체 스크림으로
    // 임의 배경에서도 텍스트 가독성을 확보한다(히어로 텍스트는 외곽선 추가).
    overlay: { top: true, topOpacity: 150, bottom: true, bottomOpacity: 225, scrim: 48 },
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

  if (input.headline) {
    config.mainCopy = {
      text: input.headline,
      color: "#FFFFFF",
      sizeRatio: 0.078,
      yRatio: Y.headline,
      center: true,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: 0.86,
      stroke: true,
    };
  }

  if (input.sub) {
    config.subCopy = {
      text: input.sub,
      color: "#FFFFFF",
      sizeRatio: 0.032,
      yRatio: Y.sub,
      center: true,
      autoFit: true,
      maxLines: 2,
      maxWidthRatio: 0.82,
      stroke: true,
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
