import { editImage, type AspectRatio, type ImagePart } from "@/lib/engines";
import { fetchAsBase64 } from "@/lib/utils/image-fetch";
import { uploadGeneratedImage } from "@/lib/storage/generated-images";
import type { UsageContext } from "@/lib/usage/record";

/**
 * 선택 이미지 편집 — 이미 생성된 결과 이미지를 입력으로 첨부해 "바꿀 것 하나 + 나머지는 그대로"로
 * 편집한다(gpt-image-2 가이드의 핵심 편집 기법). 재생성과 달리 디자인을 보존한 채 한 곳만 바뀐다.
 * full(베이킹) 결과도 이 경로로 문구·색·배경을 디자인 보존하며 수정할 수 있다.
 */
export type EditOp = "localize" | "recolor" | "background" | "add" | "remove";

export interface EditVariantInput {
  /** 편집 대상(이미 렌더된) 이미지 URL */
  sourceUrl: string;
  op: EditOp;
  /** localize: 바꿀 원문 / 새 문구 */
  from?: string | null;
  to?: string | null;
  /** recolor·remove: 대상 / recolor: 색 */
  target?: string | null;
  color?: string | null;
  /** background: 새 배경 장면 */
  scene?: string | null;
  /** add: 추가할 요소 / 위치 */
  element?: string | null;
  position?: string | null;
  aspectRatio?: AspectRatio;
}

const KEEP =
  "Keep every other element — composition, colors, fonts, background, lighting and any other text — exactly the same. Change nothing else.";

/** 편집 op → "바꿀 것 하나 + 나머지 유지" 영어 편집 지시문(가이드 편집 메타프롬프트). */
export function buildEditInstruction(input: EditVariantInput): string {
  switch (input.op) {
    case "localize":
      return `Replace the text "${(input.from ?? "").trim()}" with "${(input.to ?? "").trim()}". Keep the layout, colors, fonts, illustration, background and spacing exactly the same. Only the wording changes.`;
    case "recolor":
      return `Change ONLY ${(input.target ?? "the main color").trim()} to ${(input.color ?? "").trim()}. ${KEEP}`;
    case "background":
      return `Replace ONLY the background with ${(input.scene ?? "").trim()}. Keep the main subject, its shape, position, lighting and any text on it exactly the same. Change nothing else.`;
    case "add":
      return `Add ${(input.element ?? "").trim()}${input.position?.trim() ? ` at ${input.position.trim()}` : ""}. ${KEEP}`;
    case "remove":
      return `Remove ${(input.target ?? "").trim()}, leaving that area clean and natural. ${KEEP}`;
  }
}

export async function editGeneratedImage(
  generationId: string,
  input: EditVariantInput,
  usageContext?: UsageContext,
): Promise<{ url: string; path: string; prompt: string }> {
  const base: ImagePart | null = await fetchAsBase64(input.sourceUrl).catch(() => null);
  if (!base) throw new Error("원본 이미지를 불러올 수 없습니다");
  const prompt = buildEditInstruction(input);
  const result = await editImage({
    prompt,
    baseImage: base,
    aspectRatio: input.aspectRatio ?? "1:1",
    imageSize: "2K", // 편집은 최종 결과물 → 고품질
    usageContext,
  });
  const uploaded = await uploadGeneratedImage(generationId, `edit_${Date.now().toString(36)}`, {
    mimeType: "image/png",
    base64: result.base64,
  });
  return { url: uploaded.url, path: uploaded.path, prompt };
}
