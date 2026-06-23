import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import {
  generateSingleImageVariants,
  SINGLE_IMAGE_PROMPT_VERSION,
} from "@/lib/generate/single-image";
import { createGeneration, insertVariants } from "@/lib/generate/queries";
import { DesignReferenceSchema } from "@/lib/generate/analyze-reference";
import type { SingleImageInput } from "@/lib/generate/types";

export const maxDuration = 180;

const Schema = z.object({
  concept: z.string().min(4).max(1000),
  keyMessage: z.string().max(500).nullable().optional(),
  headline: z.string().max(120).nullable().optional(),
  sub: z.string().max(200).nullable().optional(),
  cta: z.string().max(60).nullable().optional(),
  tone: z.string().max(300).nullable().optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
  referenceImageUrl: z.string().url().nullable().optional(),
  referenceMode: z.enum(["style", "base"]).optional(),
  designRef: DesignReferenceSchema.nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  renderMode: z.enum(["overlay", "full"]).optional(),
  count: z.number().int().min(1).max(4).optional(),
});

export interface GenerateImageResponseVariant {
  id: string | null;
  label: string;
  url: string;
  selected: boolean;
  mode: string;
}

export async function POST(request: Request) {
  try {
    const input = (await parseJson(request, Schema)) as SingleImageInput;

    // 1) 생성 행 선저장 (best-effort — 마이그레이션 미적용 시에도 생성은 진행)
    let generationId: string | null = null;
    try {
      const gen = await createGeneration(input, {
        promptVersion: SINGLE_IMAGE_PROMPT_VERSION,
      });
      generationId = gen.id;
    } catch (e) {
      console.warn(
        "image_generations 저장 실패(마이그레이션 미적용?):",
        (e as Error).message,
      );
    }

    // 2) 이미지 생성 (저장 실패 시 임시 id로 storage 경로만 구성)
    const result = await generateSingleImageVariants(
      generationId ?? `tmp_${Date.now()}`,
      input,
    );

    // 3) 후보 저장 (best-effort) + 응답 정규화
    let responseVariants: GenerateImageResponseVariant[];
    if (generationId) {
      try {
        const rows = await insertVariants(generationId, result.variants);
        responseVariants = rows.map((r) => ({
          id: r.id,
          label: r.label ?? "",
          url: r.url,
          selected: r.selected,
          mode: String((r.meta_json as { mode?: string })?.mode ?? ""),
        }));
      } catch (e) {
        console.warn("image_variants 저장 실패:", (e as Error).message);
        responseVariants = result.variants.map((v, i) => ({
          id: null,
          label: v.label,
          url: v.url,
          selected: i === 0,
          mode: v.mode,
        }));
      }
    } else {
      responseVariants = result.variants.map((v, i) => ({
        id: null,
        label: v.label,
        url: v.url,
        selected: i === 0,
        mode: v.mode,
      }));
    }

    return ok({
      generationId,
      variants: responseVariants,
      failures: result.failures,
    });
  } catch (e) {
    return serverError(e);
  }
}
