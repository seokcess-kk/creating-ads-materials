import type { ImagePart } from "@/lib/engines/gemini-image";

export async function fetchAsBase64(url: string): Promise<ImagePart> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/png";
  return { mimeType, base64: buffer.toString("base64") };
}
