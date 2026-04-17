import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const { fileUrl, fileName, assetCategory, metadata } = await request.json();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("brand_assets")
      .insert({
        brand_id: brandId,
        file_url: fileUrl,
        file_name: fileName,
        asset_category: assetCategory,
        metadata_json: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Asset save error:", error);
    return NextResponse.json({ error: "에셋 저장 실패" }, { status: 500 });
  }
}
