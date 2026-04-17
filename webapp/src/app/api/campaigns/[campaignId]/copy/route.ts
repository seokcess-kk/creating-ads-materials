import { NextResponse } from "next/server";
import { generateCopy } from "@/lib/claude/generate-copy";
import { updateCampaign } from "@/lib/db/campaigns";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;

    const copyData = await generateCopy(campaignId);
    await updateCampaign(campaignId, { copy_json: copyData });

    return NextResponse.json(copyData);
  } catch (error) {
    console.error("Copy generation error:", error);
    return NextResponse.json({ error: "카피 생성 실패" }, { status: 500 });
  }
}
