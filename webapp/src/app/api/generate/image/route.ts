import { z } from "zod";
import { ok, parseJson, serverError } from "@/lib/api-utils";
import {
  generateSingleImageVariants,
  SINGLE_IMAGE_PROMPT_VERSION,
} from "@/lib/generate/single-image";
import {
  createGeneration,
  insertVariants,
  setGenerationStatus,
} from "@/lib/generate/queries";
import { DesignReferenceSchema } from "@/lib/generate/analyze-reference";
import type { SingleImageInput, SingleImageResult } from "@/lib/generate/types";

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
  /** 카피 수정 후 모델 호출 없이 재합성 가능한 후보(overlay + 배경 보존) */
  recomposable: boolean;
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  try {
    const input = (await parseJson(request, Schema)) as SingleImageInput;

    // 1) 생성 행 선저장 (best-effort — 마이그레이션 미적용 시에도 생성은 진행)
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
    let result: SingleImageResult;
    try {
      result = await generateSingleImageVariants(
        generationId ?? `tmp_${Date.now()}`,
        input,
      );
    } catch (e) {
      // 전량 실패 — 거짓 'ready'로 남지 않도록 failed로 전이.
      if (generationId) {
        await setGenerationStatus(generationId, "failed", (e as Error).message).catch(
          () => {},
        );
      }
      throw e;
    }

    // 3) 상태 전이: ready + (부분 실패 시) 요약을 error에 보존.
    if (generationId) {
      const errSummary = result.failures.length
        ? `${result.failures.length}장 실패 — ${result.failures
            .map((f) => `${f.label}: ${f.reason}`)
            .join(" / ")}`
        : null;
      await setGenerationStatus(generationId, "ready", errSummary).catch(() => {});
    }

    // 4) 후보 저장 (best-effort) + 응답 정규화
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
          recomposable: Boolean(r.bg_url),
        }));
      } catch (e) {
        console.warn("image_variants 저장 실패:", (e as Error).message);
        responseVariants = result.variants.map((v, i) => ({
          id: null,
          label: v.label,
          url: v.url,
          selected: i === 0,
          mode: v.mode,
          recomposable: false, // 영속화 실패 → 재합성 대상 행 없음
        }));
      }
    } else {
      responseVariants = result.variants.map((v, i) => ({
        id: null,
        label: v.label,
        url: v.url,
        selected: i === 0,
        mode: v.mode,
        recomposable: false,
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
