import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("brand_assets")
      .select("*")
      .eq("brand_id", brandId)
      .eq("asset_category", "key_visual")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Key visual list error:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
