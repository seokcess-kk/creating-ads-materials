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
