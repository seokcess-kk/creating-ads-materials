import { NextResponse } from "next/server";
import { generateBrief } from "@/lib/claude/generate-brief";
import { updateCampaign } from "@/lib/db/campaigns";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const { sellingPoint, campaignGoal, additionalInfo } = await request.json();

    const brief = await generateBrief(campaignId, sellingPoint, campaignGoal, additionalInfo);
    await updateCampaign(campaignId, { brief_json: brief, status: "in_progress" });

    return NextResponse.json(brief);
  } catch (error) {
    console.error("Brief generation error:", error);
    return NextResponse.json({ error: "브리프 생성 실패" }, { status: 500 });
  }
}
