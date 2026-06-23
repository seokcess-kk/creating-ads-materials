import path from "node:path";
import type { ComposeConfig, ComposeFontSet } from "@/lib/canvas/compositor";

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

export interface SingleAdLayoutInput {
  headline?: string | null;
  sub?: string | null;
  cta?: string | null;
  logoUrl?: string | null;
  /** CTA 버튼 배경(브랜드 primary) */
  brandColor?: string | null;
}

// 텍스트 오버레이 레이아웃 → ComposeConfig. backgroundImageUrl/output은 renderComposite가 무시(호환용 빈값).
export function singleAdConfig(input: SingleAdLayoutInput): ComposeConfig {
  const config: ComposeConfig = {
    backgroundImageUrl: "",
    output: { bucket: "", path: "" },
    fontSet: singleAdFontSet(),
    // AI 배경은 어디든 밝을 수 있어 상/하 그라데이션 + 은은한 전체 스크림으로
    // 임의 배경에서도 텍스트 가독성을 확보한다(히어로 텍스트는 외곽선 추가).
    overlay: { top: true, topOpacity: 150, bottom: true, bottomOpacity: 225, scrim: 48 },
  };

  if (input.logoUrl) {
    config.logo = {
      url: input.logoUrl,
      position: "top-left",
      widthRatio: 0.16,
      marginRatio: 0.05,
    };
  }

  if (input.headline) {
    config.mainCopy = {
      text: input.headline,
      color: "#FFFFFF",
      sizeRatio: 0.078,
      yRatio: 0.4,
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
      yRatio: 0.62,
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
      yRatio: 0.82,
      autoFit: true,
      maxWidthRatio: 0.7,
    };
  }

  return config;
}
