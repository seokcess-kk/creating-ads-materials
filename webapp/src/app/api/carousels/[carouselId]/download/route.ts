import { zipSync } from "fflate";
import { ApiError, serverError } from "@/lib/api-utils";
import { getCarousel } from "@/lib/carousel/queries";

export const maxDuration = 60;

/** 슬라이드 전체를 zip으로 묶어 다운로드(서버에서 fetch → fflate). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> },
) {
  try {
    const { carouselId } = await params;
    const data = await getCarousel(carouselId);
    if (!data) throw new ApiError(404, "캐러셀을 찾을 수 없습니다");

    const slides = data.slides.filter((s) => s.image_url);
    if (slides.length === 0) throw new ApiError(400, "다운로드할 슬라이드가 없습니다");

    const files: Record<string, Uint8Array> = {};
    for (const s of slides) {
      const res = await fetch(s.image_url as string);
      if (!res.ok) continue;
      files[`slide_${String(s.idx).padStart(2, "0")}.png`] = new Uint8Array(
        await res.arrayBuffer(),
      );
    }
    if (Object.keys(files).length === 0) {
      throw new ApiError(502, "슬라이드 이미지를 가져오지 못했습니다");
    }

    // PNG는 이미 압축돼 있어 store(level 0)로 충분.
    const zip = zipSync(files, { level: 0 });
    return new Response(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="carousel_${carouselId}.zip"`,
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
