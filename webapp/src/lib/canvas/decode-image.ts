import { loadImage, type Image } from "@napi-rs/canvas";
import sharp from "sharp";

/**
 * 이미지 버퍼를 @napi-rs/canvas Image로 안전하게 디코딩한다.
 *
 * @napi-rs/canvas(skia)는 일부 PNG 디코딩에 실패한다. 특히 Gemini 3 Pro Image
 * (Nano Banana Pro)는 생성 PNG의 IHDR 직후에 C2PA(Content Credentials) `caBX`
 * 청크를 삽입하는데, skia가 이를 디코딩하지 못하고 SVG 폴백 경로로 빠져
 * "Invalid SVG image"를 던진다. 손상/잘린 버퍼에서는 네이티브 세그폴트 위험도 있다.
 *
 * sharp로 먼저 표준 PNG로 재인코딩하면 부가 메타데이터(C2PA 등)가 제거되고
 * 버퍼가 검증되므로, 그 결과를 안전하게 loadImage에 넘길 수 있다.
 * sharp는 PNG/JPEG/WebP/AVIF/GIF/SVG를 모두 디코딩하므로 포맷에도 견고하다.
 */
export async function decodeImage(input: Buffer | Uint8Array): Promise<Image> {
  const normalized = await sharp(Buffer.from(input), { failOn: "none" })
    .png()
    .toBuffer();
  return loadImage(normalized);
}
