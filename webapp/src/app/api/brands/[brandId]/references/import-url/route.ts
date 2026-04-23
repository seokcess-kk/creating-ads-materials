import { z } from "zod";
import {
  createReference,
  getReferenceBySourceUrl,
  setVisionFailed,
  setVisionResult,
  type ReferenceSource,
} from "@/lib/memory";
import { analyzeBP, embedAndStoreBP } from "@/lib/vision";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";
import { parseAdUrl, platformLabel, type ParsedAdUrl } from "@/lib/imports/ads-url-parser";
import { fetchOgMeta } from "@/lib/imports/og-extractor";
import { downloadToReferenceBucket } from "@/lib/imports/store-external-image";

export const maxDuration = 60;

// UX: 이미지 URL(크리에이티브 에셋)을 primary로 받고, 원본 광고 URL은 dedup·추적용 선택.
// 대부분의 광고 라이브러리가 개별 광고 상세 페이지에 og:image를 주입하지 않아
// "source_url만 받아 og로 풀기"는 실패율이 높다. 역으로 이미지 URL을 직접 받는 쪽이 현실적.
//
// Back-compat: 초기 Phase 2 스키마는 { url, override_image_url }. TikTok 스크래퍼도 동일 형태.
// 새 이름(image_url, source_url)을 쓰되 기존 이름도 alias로 수용.
const Schema = z
  .object({
    image_url: z.string().url().optional(),
    source_url: z.string().url().optional(),
    // back-compat aliases
    url: z.string().url().optional(),
    override_image_url: z.string().url().optional(),
    override_title: z.string().max(200).nullable().optional(),

    source_type: z
      .enum(["bp_upload", "own_archive", "competitor", "industry"])
      .optional(),
    source_note: z.string().max(500).nullable().optional(),
    is_negative: z.boolean().optional(),
    weight: z.number().int().min(0).max(100).optional(),
    performance_score: z.number().int().min(1).max(5).nullable().optional(),
  })
  .refine(
    (v) => v.image_url || v.override_image_url || v.source_url || v.url,
    { message: "image_url 또는 source_url 중 최소 하나는 필요합니다" },
  );

type Input = z.infer<typeof Schema>;

interface Resolved {
  imageUrl: string | null;
  sourceUrl: string | null;
  title: string | null;
  siteName: string | null;
  parsed: ParsedAdUrl | null;
}

async function resolveInputs(input: Input): Promise<Resolved> {
  const imageUrl = input.image_url ?? input.override_image_url ?? null;
  const rawSource = input.source_url ?? input.url ?? null;
  const parsed = rawSource ? parseAdUrl(rawSource) : null;
  const sourceUrl = parsed?.canonical ?? rawSource;
  const title: string | null = input.override_title ?? null;
  const siteName: string | null = null;

  // 이미지 URL이 없을 때만 og:image 백업 시도. source_url이 있어야 가능.
  if (!imageUrl && parsed) {
    const og = await fetchOgMeta(parsed.canonical).catch(() => null);
    if (!og?.image) {
      throw new ApiError(
        422,
        `${platformLabel(parsed.platform)}에서 og:image를 찾지 못했습니다. image_url을 직접 전달하세요.`,
      );
    }
    return {
      imageUrl: og.image,
      sourceUrl,
      title: title ?? og.title,
      siteName: og.siteName,
      parsed,
    };
  }
  if (!imageUrl) {
    throw new ApiError(400, "image_url 또는 source_url 중 최소 하나는 필요합니다");
  }
  return { imageUrl, sourceUrl, title, siteName, parsed };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, Schema);
    const resolved = await resolveInputs(input);

    // dedup: source_url이 있을 때만 가능.
    if (resolved.sourceUrl) {
      const dup = await getReferenceBySourceUrl(brandId, resolved.sourceUrl);
      if (dup) throw new ApiError(409, "이미 임포트된 광고입니다");
    }

    const stored = await downloadToReferenceBucket(
      brandId,
      resolved.imageUrl!,
      resolved.parsed?.id ?? resolved.parsed?.platform ?? "imported",
    );

    const platform = resolved.parsed?.platform ?? "unknown";
    const noteParts: string[] = [];
    if (resolved.parsed) noteParts.push(platformLabel(resolved.parsed.platform));
    if (resolved.title) noteParts.push(resolved.title.slice(0, 120));
    if (input.source_note) noteParts.push(input.source_note);

    const fileNameId =
      resolved.parsed?.id ?? String(Date.now());
    const ref = await createReference(brandId, {
      file_url: stored.publicUrl,
      file_name: `${platform}_${fileNameId}.${stored.contentType.split("/")[1] ?? "jpg"}`,
      source_type: (input.source_type ?? "competitor") as ReferenceSource,
      source_note: noteParts.join(" | ") || null,
      source_url: resolved.sourceUrl,
      is_negative: input.is_negative ?? false,
      weight: input.weight ?? 50,
      performance_score: input.performance_score ?? null,
    });

    try {
      const result = await analyzeBP({
        source: { type: "url", url: stored.publicUrl },
        usageContext: { operation: "vision_bp_import_url", brandId },
      });
      await setVisionResult(ref.id, result.analysis, result.promptVersion);
      try {
        await embedAndStoreBP({
          referenceId: ref.id,
          analysis: result.analysis,
          sourceType: ref.source_type,
          note: ref.source_note,
          usageContext: { operation: "bp_embed_import_url", brandId },
        });
      } catch (eErr) {
        console.warn("BP embedding 생성 실패:", (eErr as Error).message);
      }
      return ok({
        reference: {
          ...ref,
          vision_analysis_json: result.analysis,
          vision_prompt_version: result.promptVersion,
          vision_status: "ready" as const,
          vision_analyzed_at: new Date().toISOString(),
        },
        meta: { platform, title: resolved.title, siteName: resolved.siteName },
      });
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : String(vErr);
      await setVisionFailed(ref.id, msg);
      return ok({
        reference: { ...ref, vision_status: "failed" as const, vision_error: msg },
        meta: { platform, title: resolved.title, siteName: resolved.siteName },
      });
    }
  } catch (e) {
    return serverError(e);
  }
}
