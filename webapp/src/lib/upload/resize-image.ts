// 브라우저에서 이미지를 canvas로 리사이즈 — 장변 기준 maxEdge 이하로 축소.
// 벡터/애니메이션 포맷(SVG, GIF)은 리사이즈하지 않고 원본 반환.

export interface ResizeOptions {
  maxEdge?: number;
  quality?: number;
}

const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

export async function resizeImageFile(
  file: File,
  { maxEdge = 2048, quality = 0.9 }: ResizeOptions = {},
): Promise<File> {
  if (SKIP_TYPES.has(file.type)) return file;
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await loadBitmap(file);
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    bitmap.close?.();
    return file;
  }

  const scale = maxEdge / longest;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  // PNG(투명도 보존)는 PNG로, 그 외는 JPEG(용량 이득)로.
  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outType, outType === "image/png" ? undefined : quality),
  );
  if (!blob) return file;

  const newExt = outType === "image/png" ? "png" : "jpg";
  const dot = file.name.lastIndexOf(".");
  const stem = dot >= 0 ? file.name.slice(0, dot) : file.name;
  const newName = `${stem}.${newExt}`;
  return new File([blob], newName, { type: outType, lastModified: Date.now() });
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in globalThis) {
    return await createImageBitmap(file);
  }
  // Fallback: HTMLImageElement
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    // ImageBitmap-like shim
    return img as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}
