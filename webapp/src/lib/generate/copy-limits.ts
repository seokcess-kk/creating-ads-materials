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

/** 겹침 클램프가 다루는 레이어 기하(분석 ReferenceTextLayer·합성 ComposeTextLayer 공통 부분). */
interface LayerBoxLike {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  sizeRatio: number;
  lineHeight: number;
  maxLines: number;
  align: "left" | "center" | "right";
  backgroundColor?: string;
}

function boxSpan(l: LayerBoxLike): [number, number] {
  const left = l.align === "center" ? l.xRatio - l.widthRatio / 2 : l.align === "right" ? l.xRatio - l.widthRatio : l.xRatio;
  return [left, left + l.widthRatio];
}

function boxBand(l: LayerBoxLike): [number, number] {
  return [l.yRatio - l.sizeRatio, l.yRatio + l.sizeRatio * l.lineHeight * (l.maxLines - 1) + l.sizeRatio * 0.25];
}

/**
 * 레이어 겹침 클램프 — 측정 폭 과대·긴 카피로 일반 텍스트가 같은 밴드의 필·배지 아래로
 * 파고드는 것을 방지. 필 앞에서 폭을 줄이고, center 정렬은 줄인 구간의 중심으로 앵커를
 * 다시 잡는다(폭만 줄이면 재중앙화되며 다시 침범 — 실측 검증된 버그).
 * 분석 결과와 합성 직전 양쪽에서 같은 함수를 쓴다(UI 자수 한도·카피 생성 한도와 정합).
 */
export function clampLayerOverlaps<T extends LayerBoxLike>(layers: T[]): T[] {
  const pills = layers.filter((l) => l.backgroundColor);
  if (!pills.length) return layers;
  return layers.map((layer) => {
    if (layer.backgroundColor) return layer;
    let [left, right] = boxSpan(layer);
    const [top, bottom] = boxBand(layer);
    for (const pill of pills) {
      const [pTop, pBottom] = boxBand(pill);
      if (bottom <= pTop || top >= pBottom) continue;
      const [pLeft, pRight] = boxSpan(pill);
      if (right <= pLeft || left >= pRight) continue;
      if (layer.align === "right") left = Math.max(left, pRight + 0.015);
      else right = Math.min(right, pLeft - 0.015);
    }
    const width = Math.max(0.12, right - left);
    if (Math.abs(width - layer.widthRatio) < 0.005) return layer;
    const xRatio = layer.align === "center" ? left + width / 2 : layer.align === "right" ? left + width : layer.xRatio;
    return { ...layer, widthRatio: width, xRatio };
  });
}
