import sharp from "sharp";
import type { DesignReference } from "./types";

/**
 * 원본 색 유도 실측 — 레퍼런스 재사용 경로의 궁극 수정.
 *
 * 좌표·크기·색을 비전 LLM이 '추정'하게 하는 것이 앵커 오류·색 반전·폭 과대·가짜
 * 그라디언트의 공통 원인이었다. 한편 제거본과의 픽셀 차분은 제거 편집의 장면 드리프트
 * (매번 다른 미세 확대/이동 재생성)에 오염된다 — 안정적 기준은 '원본 픽셀'뿐이다.
 *
 * 방식(레이어별, 원본만 사용):
 *  1) 비전 시드 주변(±6%)에서 링(장면색)을 구한다.
 *  2) 장면과 구별되는(≥52) 레이어 색 후보(글자색·필 배경색, 픽셀 스냅 완료)에 매칭되는
 *     픽셀들의 백분위(2~98%) 박스 = 정밀 박스. 매칭 부족 시 '장면과 다른 모든 픽셀'로 폴백.
 *  3) 그 박스 안에서 색을 재도출: 컨테이너는 박스 지배색=배경, 글자=배경과 먼 색(비전 prior 우선).
 *     줄 수는 글자색 행 런. 실측 불충분 레이어는 비전 값 유지(안전 강등).
 */

const W = 384;
const PAD = 0.06;

interface Cluster {
  rgb: [number, number, number];
  count: number;
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function parseHex(color?: string | null): [number, number, number] | null {
  const m = color?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function clusterize(colors: Array<[number, number, number]>): Cluster[] {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (const [r, g, b] of colors) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const item = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    item.count++;
    item.r += r;
    item.g += g;
    item.b += b;
    buckets.set(key, item);
  }
  return [...buckets.values()]
    .map((it) => ({ rgb: [it.r / it.count, it.g / it.count, it.b / it.count] as [number, number, number], count: it.count }))
    .sort((a, b) => b.count - a.count);
}

/** 백분위 박스 — 고립 매칭(노이즈)이 박스를 늘리는 것을 막는다. */
function percentileBox(xs: number[], ys: number[], lo = 0.02, hi = 0.98) {
  const sx = [...xs].sort((a, b) => a - b);
  const sy = [...ys].sort((a, b) => a - b);
  const pick = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))];
  return {
    left: pick(sx, lo),
    right: pick(sx, hi),
    top: pick(sy, lo),
    bottom: pick(sy, hi),
  };
}

type Layers = NonNullable<DesignReference["textLayers"]>;

/**
 * 원본 픽셀에서 비전 레이어의 기하·색·줄수를 실측 보정한다(제거본 불필요 — 드리프트 무관).
 * 레이어별로 실패하면 그 레이어만 비전 값을 유지한다.
 */
export async function refineLayersFromOriginal(
  original: Buffer,
  visionLayers: Layers,
): Promise<Layers> {
  if (!visionLayers.length) return visionLayers;
  const meta = await sharp(original).metadata();
  if (!meta.width || !meta.height) return visionLayers;
  const H = Math.max(64, Math.round(W * (meta.height / meta.width)));
  const { data, info } = await sharp(original)
    .resize(W, H, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * W + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // 시드 기하 선계산 — 보로노이 배타(같은 색 이웃 레이어의 픽셀 침범 차단)에 전 시드가 필요.
  const seedGeoms = visionLayers.map((l) => {
    const left = l.align === "center" ? l.xRatio - l.widthRatio / 2 : l.align === "right" ? l.xRatio - l.widthRatio : l.xRatio;
    const top = l.yRatio - l.sizeRatio * 1.15;
    const height = l.sizeRatio * l.lineHeight * l.maxLines * 1.3;
    return {
      left, top, right: left + l.widthRatio, bottom: top + height,
      cx: left + l.widthRatio / 2, cy: top + height / 2,
    };
  });
  /** 픽셀이 이 레이어 소유인가 — 시드 박스들이 겹치면 중심이 가까운 쪽이 가져간다. */
  const ownedBy = (fx: number, fy: number, idx: number): boolean => {
    const mine = Math.hypot(fx - seedGeoms[idx].cx, fy - seedGeoms[idx].cy);
    for (let j = 0; j < seedGeoms.length; j++) {
      if (j === idx) continue;
      const s = seedGeoms[j];
      const inOther = fx >= s.left - 0.01 && fx <= s.right + 0.01 && fy >= s.top - 0.01 && fy <= s.bottom + 0.01;
      if (inOther && Math.hypot(fx - s.cx, fy - s.cy) < mine) return false;
    }
    return true;
  };

  return visionLayers.map((layer, layerIdx) => {
    // 시드 주변(±PAD) — 비전의 '대략 위치'만 신뢰한다.
    const geom = seedGeoms[layerIdx];
    const x0 = Math.max(0, Math.floor((geom.left - PAD) * W));
    const x1 = Math.min(W - 1, Math.ceil((geom.right + PAD) * W));
    const y0 = Math.max(0, Math.floor((geom.top - PAD) * H));
    const y1 = Math.min(H - 1, Math.ceil((geom.bottom + PAD) * H));
    if (x1 - x0 < 6 || y1 - y0 < 4) return layer;

    // 1) 링(장면색): 주변 테두리 평균.
    let ringSum: [number, number, number] = [0, 0, 0];
    let ringCount = 0;
    const rim = Math.max(2, Math.round((y1 - y0) / 5));
    for (let y = Math.max(0, y0 - rim); y <= Math.min(H - 1, y1 + rim); y++) {
      for (let x = Math.max(0, x0 - rim); x <= Math.min(W - 1, x1 + rim); x++) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
        const c = px(x, y);
        ringSum = [ringSum[0] + c[0], ringSum[1] + c[1], ringSum[2] + c[2]];
        ringCount++;
      }
    }
    const ring: [number, number, number] | null = ringCount >= 12
      ? [ringSum[0] / ringCount, ringSum[1] / ringCount, ringSum[2] / ringCount]
      : null;

    // 2) 기하 매칭 → 백분위 박스. 1차: 비전 색(글자·필 배경) 매칭 — 일러스트 오브젝트(쿠폰 등)를
    //    배제하는 핵심. 2차 폴백: 장면(링)과 다른 모든 픽셀. 양쪽 모두 보로노이 소유 픽셀만
    //    (흰 헤드라인 옆 흰 오기록 눈썹 같은 동색 이웃 침범 차단).
    const targets = [parseHex(layer.color), parseHex(layer.backgroundColor)]
      .filter((c): c is [number, number, number] => c != null)
      .filter((c) => !ring || dist3(c, ring) >= 52);
    const xs: number[] = [];
    const ys: number[] = [];
    const collect = (match: (c: [number, number, number]) => boolean) => {
      xs.length = 0;
      ys.length = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!match(px(x, y))) continue;
          if (!ownedBy(x / W, y / H, layerIdx)) continue;
          xs.push(x);
          ys.push(y);
        }
      }
    };
    if (targets.length) collect((c) => targets.some((t) => dist3(c, t) <= 64));
    const minPixels = Math.max(20, Math.round((x1 - x0) * (y1 - y0) * 0.004));
    if (xs.length < minPixels && ring) collect((c) => dist3(c, ring) >= 64);
    if (xs.length < minPixels) return layer;

    const box = percentileBox(xs, ys);
    if (box.right - box.left < 4 || box.bottom - box.top < 2) return layer;
    // 실측 박스가 시드 중심에서 과도하게 이탈하면(엉뚱한 요소를 잡음) 비전 값을 유지한다.
    const drift = Math.hypot(
      (box.left + box.right + 1) / 2 / W - geom.cx,
      (box.top + box.bottom + 1) / 2 / H - geom.cy,
    );
    if (drift > 0.12) return layer;

    // 3) 박스 안 색 재도출.
    const rect: Array<[number, number, number]> = [];
    for (let y = box.top; y <= box.bottom; y++) {
      for (let x = box.left; x <= box.right; x++) rect.push(px(x, y));
    }
    const clusters = clusterize(rect);
    const isContainer = Boolean(layer.backgroundColor);
    // 컨테이너: 박스 지배색 중 장면과 구별되는 첫 색 = 필 배경 / 맨글자: 장면색이 지배해도 무방.
    const bg = isContainer
      ? clusters.find((c) => !ring || dist3(c.rgb, ring) >= 40) ?? clusters[0]
      : null;
    const base = bg?.rgb ?? ring ?? clusters[0].rgb;
    const prior = parseHex(layer.color);
    const glyphCandidates = clusters.filter((c) => dist3(c.rgb, base) >= 48);
    const glyph =
      (prior ? glyphCandidates.find((c) => dist3(c.rgb, prior) <= 72) : undefined) ??
      glyphCandidates[0];
    if (!glyph) return layer;

    // 줄 수: 글자색 행 런.
    let lines = 0;
    let inRun = false;
    let emptyStreak = 0;
    for (let y = box.top; y <= box.bottom; y++) {
      let hasGlyph = false;
      for (let x = box.left; x <= box.right; x++) {
        if (dist3(px(x, y), glyph.rgb) < 56) {
          hasGlyph = true;
          break;
        }
      }
      if (hasGlyph) {
        if (!inRun) lines++;
        inRun = true;
        emptyStreak = 0;
      } else if (inRun && ++emptyStreak >= 2) {
        inRun = false;
      }
    }
    lines = Math.max(1, Math.min(4, lines));

    const bLeft = box.left / W;
    const bTop = box.top / H;
    const bWidth = (box.right - box.left + 1) / W;
    const bHeight = (box.bottom - box.top + 1) / H;
    const lineHeightPx = bHeight / lines;
    const sizeFactor = isContainer ? 0.55 : 0.82;
    return {
      ...layer,
      xRatio: bLeft + bWidth / 2,
      yRatio: Math.min(1, bTop + lineHeightPx * (isContainer ? 0.68 : 0.82)),
      widthRatio: Math.min(1, bWidth * 1.04),
      sizeRatio: Math.max(0.012, Math.min(0.3, lineHeightPx * sizeFactor)),
      lineHeight: 1.12,
      align: "center" as const,
      maxLines: lines,
      color: toHex(glyph.rgb),
      backgroundColor: isContainer && bg ? toHex(bg.rgb) : layer.backgroundColor,
      // 실측 경로에서는 비전의 그라디언트 추정을 신뢰하지 않는다(가짜 그라디언트 사고).
      gradientEndColor: undefined,
      cornerRadiusRatio: isContainer ? Math.min(0.08, bHeight / 2) : layer.cornerRadiusRatio,
    };
  });
}
