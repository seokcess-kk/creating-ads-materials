import { NextResponse } from "next/server";
import { analyzeBrandAssets } from "@/lib/claude/analyze-brand";
import { updateBrandStyleGuide, getBrand } from "@/lib/db/brands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const { assetUrls } = await request.json();

    if (!assetUrls || assetUrls.length === 0) {
      return NextResponse.json({ error: "분석할 에셋이 없습니다" }, { status: 400 });
    }

    const brand = await getBrand(brandId);
    const styleGuide = await analyzeBrandAssets(assetUrls, brand.website_url || undefined);
    const updated = await updateBrandStyleGuide(brandId, styleGuide);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Brand analysis error:", error);
    return NextResponse.json(
      { error: "브랜드 분석 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
