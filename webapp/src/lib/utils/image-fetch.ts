import type { ImagePart } from "@/lib/engines/gemini-image";

export async function fetchAsBase64(url: string): Promise<ImagePart> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/png";
  return { mimeType, base64: buffer.toString("base64") };
}

/** URL → Buffer. 단일 이미지 재합성·캐러셀 배경 재사용 공용(이전엔 양쪽에 중복 정의). */
export async function fetchAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`배경 이미지 fetch 실패: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
