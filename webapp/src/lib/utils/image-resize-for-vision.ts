// Claude Vision 입력용 이미지 다운샘플.
// Claude Vision은 이미지 1장당 토큰이 해상도·종횡비에 비례. 2K 원본을 그대로
// 보내면 ~5000 토큰/장. BP 8축 분석·Validator hook 판단 모두 1024px 긴 변
// JPEG로 충분하다. ~70% 절감.

import { createCanvas, loadImage } from "@napi-rs/canvas";

export interface ResizedImage {
  base64: string;
  mediaType: "image/jpeg";
  width: number;
  height: number;
}

const TARGET_LONG_EDGE = 1024;
const JPEG_QUALITY = 80;

export async function fetchAndResizeForVision(
  url: string,
): Promise<ResizedImage> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`이미지 fetch 실패 (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const img = await loadImage(buf);
  const w = img.width;
  const h = img.height;
  const scale = Math.min(1, TARGET_LONG_EDGE / Math.max(w, h));
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));

  const canvas = createCanvas(dw, dh);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, dw, dh);
  const buffer = canvas.toBuffer("image/jpeg", JPEG_QUALITY);

  return {
    base64: buffer.toString("base64"),
    mediaType: "image/jpeg",
    width: dw,
    height: dh,
  };
}
