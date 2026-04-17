import { NextResponse } from "next/server";
import { analyzeLogos } from "@/lib/claude/analyze-logo";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const { logoUrls } = await request.json();

    if (!logoUrls || logoUrls.length === 0) {
      return NextResponse.json({ error: "로고 이미지가 없습니다" }, { status: 400 });
    }

    // Claude로 로고 분석
    const analyses = await analyzeLogos(logoUrls);

    // 분석 결과를 brand_assets에 저장
    const supabase = createAdminClient();
    const savedAssets = [];

    for (let i = 0; i < analyses.length; i++) {
      const analysis = analyses[i];
      const url = logoUrls[i];
      if (!url) continue;

      const { data, error } = await supabase
        .from("brand_assets")
        .insert({
          brand_id: brandId,
          file_url: url,
          file_name: `logo_${i}`,
          asset_category: "logo",
          metadata_json: {
            variant: analysis.variant,
            theme: analysis.theme,
            has_transparency: analysis.has_transparency,
            dominant_color: analysis.dominant_color,
            suitable_for: analysis.suitable_for,
            has_text: analysis.has_text,
            quality_score: analysis.quality_score,
          },
          analysis_json: analysis,
        })
        .select()
        .single();

      if (!error && data) savedAssets.push(data);
    }

    return NextResponse.json({ analyses, assets: savedAssets });
  } catch (error) {
    console.error("Logo analysis error:", error);
    return NextResponse.json({ error: "로고 분석 실패" }, { status: 500 });
  }
}
