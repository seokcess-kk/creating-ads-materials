import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import { editGeneratedImage, type EditOp } from "@/lib/generate/edit-variant";
import { insertEditedVariant } from "@/lib/generate/queries";

export const maxDuration = 120;

const Body = z.object({
  sourceUrl: z.string().url(),
  op: z.enum(["localize", "recolor", "background", "add", "remove"]),
  from: z.string().max(200).nullable().optional(),
  to: z.string().max(200).nullable().optional(),
  target: z.string().max(200).nullable().optional(),
  color: z.string().max(120).nullable().optional(),
  scene: z.string().max(400).nullable().optional(),
  element: z.string().max(200).nullable().optional(),
  position: z.string().max(120).nullable().optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
});

const OP_LABEL: Record<EditOp, string> = {
  localize: "문구",
  recolor: "색",
  background: "배경",
  add: "추가",
  remove: "제거",
};

/** 선택 이미지 편집 — 결과 이미지를 base로 editImage("바꿀 것 하나 + 나머지 유지"). 새 후보로 추가. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  try {
    const { generationId } = await params;
    const body = await parseJson(request, Body);
    const edited = await editGeneratedImage(generationId, body, {
      operation: "single_image_edit_op",
      brandId: null,
      metadata: { generationId, op: body.op },
    });
    const variant = await insertEditedVariant(generationId, {
      url: edited.url,
      path: edited.path,
      label: `편집·${OP_LABEL[body.op]}`,
      meta: { mode: "edit", op: body.op, prompt: edited.prompt },
    });
    return ok({
      variant: {
        id: variant.id,
        label: variant.label ?? "",
        url: variant.url,
        selected: false,
        mode: "edit",
        recomposable: false,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
