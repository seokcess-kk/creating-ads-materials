import { NextResponse } from "next/server";
import { getBestPractices } from "@/lib/db/best-practices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const bps = await getBestPractices(brandId);
    return NextResponse.json(bps);
  } catch (error) {
    console.error("BP list error:", error);
    return NextResponse.json({ error: "BP 목록 조회 실패" }, { status: 500 });
  }
}
