import type { ReferenceTextLayer, ReferenceTypographyProfile } from "./types";

/**
 * 레퍼런스 타이포 측정값 → 카피 자수 한도(공백 제외).
 * 서버(생성 전 차단)와 클라이언트(입력란 사전 안내)가 같은 공식을 쓴다 — Node 의존 없음.
 * 한글 정방형 글리프 폭을 약 0.9em으로 잡은 보수적 추정. 실제 측정은 compositor가 수행한다.
 */
export interface CopyLimits {
  headline: number;
  /** sub 측정값이 없으면 null(한도 없음). */
  sub: number | null;
}

/** 부동소수점 오차(0.72/0.072=9.999…)로 한 글자를 잃지 않도록 epsilon을 더해 내림. */
const perLine = (widthRatio: number, sizeRatio: number) =>
  Math.floor(widthRatio / (sizeRatio * 0.9) + 1e-9);

export function copyLimitsForTypography(t: ReferenceTypographyProfile): CopyLimits {
  const headlinePerLine = Math.max(4, perLine(t.headlineMaxWidthRatio, t.headlineSizeRatio));
  const sub =
    t.subSizeRatio && t.subMaxWidthRatio
      ? Math.max(6, perLine(t.subMaxWidthRatio, t.subSizeRatio)) * 2
      : null;
  return { headline: headlinePerLine * 2, sub };
}

/**
 * 렌더 폭 기준 글자 수(서로게이트 안전) — 일반 글자 1, 내부 공백 0.5.
 * 공백도 실제 렌더 폭을 차지하므로 제외하면 "한도는 통과했는데 실제로는 축소되는" 갭이 생긴다.
 */
export function countCopyChars(value?: string | null): number {
  const chars = Array.from(value?.trim() ?? "");
  if (!chars.length) return 0;
  const spaces = chars.filter((c) => /\s/.test(c)).length;
  return Math.ceil(chars.length - spaces * 0.5);
}

/** 실측 레이어 1개의 역할·자수 한도 — 디자인 인지 카피 생성과 UI 안내가 공유. */
export interface LayerCopySpec {
  role: ReferenceTextLayer["role"];
  maxChars: number;
  maxLines: number;
}

/**
 * 실측 textLayers → 역할별 카피 스펙. 같은 0.9em 글리프 폭 추정을 쓴다(1:1 캔버스 기준 근사).
 * 카피라이터가 "박스에 맞는 카피"를 처음부터 쓰도록 프롬프트 제약으로 주입된다.
 */
export function layerCopySpecs(layers: ReferenceTextLayer[]): LayerCopySpec[] {
  return layers.map((layer) => ({
    role: layer.role,
    maxChars: Math.max(2, perLine(layer.widthRatio, layer.sizeRatio)) * layer.maxLines,
    maxLines: layer.maxLines,
  }));
}
