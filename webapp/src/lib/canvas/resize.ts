import sharp from "sharp";
import type { AspectRatio } from "@/lib/engines";

/**
 * 비율 → 채널 목표 픽셀. 생성 모델(OpenAI 1024x1536 등)이 채널 규격과 다른 크기를 내므로,
 * 합성/출력 직전에 이 크기로 cover-crop해 실제 업로드 규격(1080 계열)을 맞춘다.
 * (lib/channels.ts의 대표 픽셀과 정합 — 1:1/4:5/9:16/16:9. 3:4/4:3은 보조.)
 */
const TARGET_PIXELS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "3:4": { width: 1080, height: 1440 },
  "4:3": { width: 1440, height: 1080 },
};

export function targetPixels(
  aspect: AspectRatio | undefined,
): { width: number; height: number } | null {
  return aspect ? TARGET_PIXELS[aspect] ?? null : null;
}

/**
 * 생성물을 채널 목표 픽셀로 cover-crop 리사이즈해 PNG 버퍼로 반환.
 * 목표 비율을 모르면 원본을 그대로 반환(안전 폴백).
 * overlay 모드에선 합성 전 배경에 적용해, 텍스트가 최종 해상도에서 또렷하게 렌더되도록 한다.
 */
export async function resizeToChannel(
  buf: Buffer,
  aspect: AspectRatio | undefined,
): Promise<Buffer> {
  const target = targetPixels(aspect);
  if (!target) return buf;
  return sharp(buf, { failOn: "none" })
    .resize(target.width, target.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}
