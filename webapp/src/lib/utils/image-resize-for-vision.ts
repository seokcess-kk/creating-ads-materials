// Claude Vision 입력용 이미지 다운샘플.
// Claude Vision은 이미지 1장당 토큰이 해상도·종횡비에 비례. 2K 원본을 그대로
// 보내면 ~5000 토큰/장. BP 8축 분석·Validator hook 판단 모두 1024px 긴 변
// JPEG로 충분하다. ~70% 절감.
//
// 디코딩은 sharp로 한다. @napi-rs/canvas(skia)는 Gemini가 삽입하는 C2PA `caBX`
// 청크 PNG 디코딩에 실패("Invalid SVG image")하므로, 부가 메타데이터에 견고한
// sharp로 디코딩+리사이즈+JPEG 인코딩을 한 번에 처리한다.

import sharp from "sharp";

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

  const { data, info } = await sharp(buf, { failOn: "none" })
    .rotate() // EXIF 방향 반영
    .resize(TARGET_LONG_EDGE, TARGET_LONG_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    base64: data.toString("base64"),
    mediaType: "image/jpeg",
    width: info.width,
    height: info.height,
  };
}
