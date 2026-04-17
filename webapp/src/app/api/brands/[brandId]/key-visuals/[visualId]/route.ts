import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brandId: string; visualId: string }> }
) {
  try {
    const { visualId } = await params;
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("brand_assets")
      .delete()
      .eq("id", visualId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Key visual delete error:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
