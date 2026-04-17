import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/db/campaigns";
import { getCreatives, updateCreative } from "@/lib/db/creatives";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    const creatives = await getCreatives(campaignId);
    const copyData = campaign.copy_json as { copies?: Array<{ channel: string; variations: Array<Record<string, string>> }> };

    // 각 크리에이티브에 대해 첫 번째 카피 변형을 매핑
    for (const creative of creatives) {
      const channelCopy = copyData.copies?.find(
        (c) => c.channel === creative.channel
      );
      const firstVariation = channelCopy?.variations?.[0];

      if (firstVariation) {
        await updateCreative(creative.id, {
          copy_json: firstVariation,
          status: "composed",
        });
      }
    }

    // 캠페인 상태 업데이트
    await updateCampaign(campaignId, { status: "completed" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Compose error:", error);
    return NextResponse.json({ error: "합성 실패" }, { status: 500 });
  }
}
