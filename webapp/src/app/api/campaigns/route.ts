import { NextResponse } from "next/server";
import { createCampaign } from "@/lib/db/campaigns";

export async function POST(request: Request) {
  try {
    const { brandId, name, description, targetChannels } = await request.json();

    if (!brandId || !name) {
      return NextResponse.json({ error: "brandId, name 필수" }, { status: 400 });
    }

    const campaign = await createCampaign({
      brandId,
      name,
      description,
      targetChannels: targetChannels || [],
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Campaign creation error:", error);
    return NextResponse.json({ error: "캠페인 생성 실패" }, { status: 500 });
  }
}
