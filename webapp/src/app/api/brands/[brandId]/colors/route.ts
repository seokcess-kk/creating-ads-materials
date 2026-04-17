import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const { colors } = await request.json();

    const supabase = createAdminClient();

    // 기존 컬러 삭제 후 새로 삽입
    await supabase.from("brand_colors").delete().eq("brand_id", brandId);

    const rows = colors.map((c: { role: string; hex: string; usage: string }, i: number) => ({
      brand_id: brandId,
      role: c.role,
      hex: c.hex,
      usage: c.usage,
      sort_order: i,
    }));

    const { data, error } = await supabase
      .from("brand_colors")
      .insert(rows)
      .select();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Colors save error:", error);
    return NextResponse.json({ error: "컬러 저장 실패" }, { status: 500 });
  }
}
