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
 * 생성물을 채널 목표 픽셀로 리사이즈해 PNG 버퍼로 반환. 목표 비율을 모르면 원본 그대로(안전 폴백).
 *
 * - allowCrop=true(기본, overlay 배경): cover-crop. 텍스트 없는 배경이라 가장자리가 잘려도 안전하며,
 *   합성 전 적용해 텍스트가 최종 해상도에서 또렷하게 렌더되도록 한다.
 * - allowCrop=false(full/edit): 텍스트·로고가 이미지에 베이킹되어 cover-crop이 이를 잘라낼 수 있으므로,
 *   소스 비율이 목표와 (거의) 같을 때만 스케일하고, 다르면 원본을 그대로 둔다(잘림 방지).
 */
export async function resizeToChannel(
  buf: Buffer,
  aspect: AspectRatio | undefined,
  opts: { allowCrop?: boolean } = {},
): Promise<Buffer> {
  const target = targetPixels(aspect);
  if (!target) return buf;
  const allowCrop = opts.allowCrop ?? true;

  if (allowCrop) {
    return sharp(buf, { failOn: "none" })
      .resize(target.width, target.height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  }

  // 베이킹된 콘텐츠: 비율이 다르면 잘림이 발생하므로 건드리지 않는다. 비율이 같을 때만 순수 스케일.
  const img = sharp(buf, { failOn: "none" });
  const meta = await img.metadata();
  if (!meta.width || !meta.height) return buf;
  const srcRatio = meta.width / meta.height;
  const tgtRatio = target.width / target.height;
  if (Math.abs(srcRatio - tgtRatio) > 0.01) return buf; // 비율 불일치 → 잘림 방지 위해 원본 유지
  if (meta.width === target.width && meta.height === target.height) return buf; // 이미 정확 → no-op
  return img.resize(target.width, target.height, { fit: "fill" }).png().toBuffer();
}
