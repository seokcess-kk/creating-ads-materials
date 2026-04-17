import { NextResponse } from "next/server";
import { createBestPractice, updateBestPractice } from "@/lib/db/best-practices";
import { analyzeBP } from "@/lib/claude/analyze-bp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> }
) {
  try {
    const { brandId } = await params;
    const { fileUrl, fileName, source, tags, analyze } = await request.json();

    const bp = await createBestPractice({
      brandId,
      fileUrl,
      fileName,
      source,
      tags,
    });

    // 분석 요청이 있으면 Claude로 분석
    if (analyze) {
      try {
        const analysis = await analyzeBP(fileUrl);
        await updateBestPractice(bp.id, { analysis_json: analysis });
        return NextResponse.json({ ...bp, analysis_json: analysis });
      } catch {
        // 분석 실패해도 BP 자체는 저장됨
        return NextResponse.json(bp);
      }
    }

    return NextResponse.json(bp);
  } catch (error) {
    console.error("BP creation error:", error);
    return NextResponse.json({ error: "BP 저장 실패" }, { status: 500 });
  }
}
