import { z } from "zod";
import { getBrand } from "@/lib/memory";
import { extractNoticeMeta } from "@/lib/notice/extract";
import { ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 60;

const Schema = z.object({
  raw_content: z.string().min(10).max(8000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, Schema);

    // RLS 경계: 접근 불가/부재 브랜드면 null.
    const brand = await getBrand(brandId);
    if (!brand) return serverError(new Error("브랜드를 찾을 수 없습니다"));

    const notice_meta = await extractNoticeMeta(input.raw_content, {
      operation: "notice_extract",
      brandId,
    });

    return ok({ notice_meta });
  } catch (e) {
    return serverError(e);
  }
}
