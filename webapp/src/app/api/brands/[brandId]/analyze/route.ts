import { NextResponse } from "next/server";
import { analyzeBrandAssets } from "@/lib/claude/analyze-brand";
import { updateBrandStyleGuide, getBrand } from "@/lib/db/brands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const body = await request.json();
    const { assetUrls, websiteUrl } = body;

    const brand = await getBrand(brandId);
    const siteUrl = websiteUrl || brand.website_url;

    // 에셋 URL이 있으면 이미지 분석, 없으면 웹사이트만 분석
    const styleGuide = await analyzeBrandAssets(
      assetUrls || [],
      siteUrl || undefined
    );
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
