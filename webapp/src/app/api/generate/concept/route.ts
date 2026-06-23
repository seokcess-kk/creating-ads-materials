import { z } from "zod";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import { getBrand } from "@/lib/memory";
import { analyzeReferenceForDraft } from "@/lib/generate/analyze-reference";

export const maxDuration = 60;

const Schema = z.object({
  referenceImageUrl: z.string().url(),
  keyMessage: z.string().max(500).nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
});

/** 레퍼런스 이미지 → 컨셉 초안 + 디자인 요소(생성 시 재사용). */
export async function POST(request: Request) {
  try {
    const input = await parseJson(request, Schema);
    const brand = input.brandId ? await getBrand(input.brandId) : null;
    const draft = await analyzeReferenceForDraft(
      input.referenceImageUrl,
      {
        keyMessage: input.keyMessage,
        brandName: brand?.name ?? null,
        brandCategory: brand?.category ?? null,
      },
      { operation: "single_image_ref_draft", brandId: input.brandId ?? null },
    );
    if (!draft) throw new ApiError(502, "레퍼런스에서 컨셉을 도출하지 못했습니다");
    return ok({ conceptDraft: draft.conceptDraft, designRef: draft.design });
  } catch (e) {
    return serverError(e);
  }
}
