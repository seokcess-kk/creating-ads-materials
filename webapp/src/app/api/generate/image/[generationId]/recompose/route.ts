import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { recomposeVariant } from "@/lib/generate/single-image";

export const maxDuration = 60;

const Body = z.object({
  variantId: z.string().uuid(),
  headline: z.string().max(120).nullable().optional(),
  sub: z.string().max(200).nullable().optional(),
  cta: z.string().max(60).nullable().optional(),
});

/** 카피 수정 → 보존된 배경으로 재합성(이미지 모델 호출 없음). overlay 후보만 가능. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  try {
    const { generationId } = await params;
    const body = await parseJson(request, Body);
    const variant = await recomposeVariant(generationId, body);
    return ok({ variant });
  } catch (e) {
    return serverError(e);
  }
}
