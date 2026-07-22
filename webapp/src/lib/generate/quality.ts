import sharp from "sharp";
import type { ReferenceTextLayer } from "./types";

export interface CopyZoneViolation {
  role: ReferenceTextLayer["role"];
  edgeDensity: number;
}

/**
 * 텍스트 박스 내부의 고주파 에지 비율을 측정한다.
 * 단색/완만한 그라디언트는 통과하고 제품·얼굴·복잡한 장식 침범은 실패한다.
 */
export async function findBusyCopyZones(
  image: Buffer,
  layers: ReferenceTextLayer[],
  threshold = 0.13,
): Promise<CopyZoneViolation[]> {
  if (!layers.length) return [];
  const { data, info } = await sharp(image)
    .resize(256, 256, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const violations: CopyZoneViolation[] = [];

  for (const layer of layers) {
    const leftRatio = layer.align === "center"
      ? layer.xRatio - layer.widthRatio / 2
      : layer.align === "right"
        ? layer.xRatio - layer.widthRatio
        : layer.xRatio;
    const topRatio = layer.yRatio - layer.sizeRatio * 1.15;
    const heightRatio = layer.sizeRatio * layer.lineHeight * layer.maxLines * 1.15;
    const left = Math.max(1, Math.floor(leftRatio * info.width));
    const right = Math.min(info.width - 1, Math.ceil((leftRatio + layer.widthRatio) * info.width));
    const top = Math.max(1, Math.floor(topRatio * info.height));
    const bottom = Math.min(info.height - 1, Math.ceil((topRatio + heightRatio) * info.height));
    if (right <= left || bottom <= top) continue;

    let edges = 0;
    let samples = 0;
    for (let y = top; y < bottom; y += 2) {
      for (let x = left; x < right; x += 2) {
        const value = data[y * info.width + x];
        const dx = Math.abs(value - data[y * info.width + x + 1]);
        const dy = Math.abs(value - data[(y + 1) * info.width + x]);
        if (dx > 24 || dy > 24) edges++;
        samples++;
      }
    }
    const edgeDensity = samples ? edges / samples : 0;
    if (edgeDensity > threshold) violations.push({ role: layer.role, edgeDensity });
  }
  return violations;
}

export function copyZoneCorrection(violations: CopyZoneViolation[]): string {
  const roles = [...new Set(violations.map((v) => v.role))].join(", ");
  return `\n\nQUALITY CORRECTION: The previous attempt placed detailed objects inside these reserved text boxes: ${roles}. Move every subject, product edge, highlight and decorative shape completely outside those exact reference text-layer rectangles. Keep the rectangles visually calm while preserving the reference grid, density and palette. Still render no text.`;
}

function layerBox(
  layer: ReferenceTextLayer,
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } | null {
  const leftRatio = layer.align === "center"
    ? layer.xRatio - layer.widthRatio / 2
    : layer.align === "right"
      ? layer.xRatio - layer.widthRatio
      : layer.xRatio;
  const topRatio = layer.yRatio - layer.sizeRatio * 1.15;
  const heightRatio = layer.sizeRatio * layer.lineHeight * layer.maxLines * 1.15;
  const left = Math.max(0, Math.floor(leftRatio * width));
  const right = Math.min(width, Math.ceil((leftRatio + layer.widthRatio) * width));
  const top = Math.max(0, Math.floor(topRatio * height));
  const bottom = Math.min(height, Math.ceil((topRatio + heightRatio) * height));
  if (right <= left || bottom <= top) return null;
  return { left, right, top, bottom };
}

function hexLuminance(color: string): number | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return 0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255);
}

/**
 * 실측 레이어의 글자색 vs 해당 존 배경 픽셀의 휘도 대비를 검사한다.
 * 배경 모델이 그 자리를 밝게/어둡게 바꿔 '주황-위-주황' 같은 저대비가 생기는 문제를
 * 결정적으로 검출 — 걸린 역할은 컴포지터가 대비 스트로크·배킹으로 보정한다.
 * 배경색이 명시된 레이어(필·배지)는 컴포지터가 배경까지 그리므로 검사 대상이 아니다.
 */
export async function findLowContrastLayers(
  image: Buffer,
  layers: ReferenceTextLayer[],
  threshold = 72,
): Promise<ReferenceTextLayer["role"][]> {
  const targets = layers.filter((l) => !l.backgroundColor && hexLuminance(l.color) != null);
  if (!targets.length) return [];
  const { data, info } = await sharp(image)
    .resize(256, 256, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const roles: ReferenceTextLayer["role"][] = [];
  for (const layer of targets) {
    const box = layerBox(layer, info.width, info.height);
    if (!box) continue;
    let sum = 0;
    let samples = 0;
    for (let y = box.top; y < box.bottom; y += 2) {
      for (let x = box.left; x < box.right; x += 2) {
        sum += data[y * info.width + x];
        samples++;
      }
    }
    if (!samples) continue;
    const zoneLuminance = sum / samples;
    const textLuminance = hexLuminance(layer.color)!;
    if (Math.abs(textLuminance - zoneLuminance) < threshold) roles.push(layer.role);
  }
  return [...new Set(roles)];
}
