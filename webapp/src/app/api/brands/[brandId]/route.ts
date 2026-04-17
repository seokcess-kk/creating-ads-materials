import { NextResponse } from "next/server";
import { deleteBrand } from "@/lib/db/brands";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;

    // Storage의 브랜드 관련 파일도 삭제
    const supabase = createAdminClient();
    const buckets = ["brand-assets", "generated-images", "creatives"];
    for (const bucket of buckets) {
      const { data: files } = await supabase.storage.from(bucket).list(brandId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${brandId}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    }

    // DB 삭제 (CASCADE로 brand_assets, best_practices, campaigns, creatives 자동 삭제)
    await deleteBrand(brandId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Brand delete error:", error);
    return NextResponse.json({ error: "브랜드 삭제 실패" }, { status: 500 });
  }
}
