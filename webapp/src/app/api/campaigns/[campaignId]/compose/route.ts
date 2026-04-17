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
    const copyData = campaign.copy_json as {
      copies?: Array<{
        channel: string;
        variations: Array<Record<string, string>>;
      }>;
    };

    // 채널별로 크리에이티브를 그룹화
    const byChannel: Record<string, typeof creatives> = {};
    for (const creative of creatives) {
      const ch = creative.channel as string;
      if (!byChannel[ch]) byChannel[ch] = [];
      byChannel[ch].push(creative);
    }

    // 각 채널의 크리에이티브에 서로 다른 카피 변형을 매핑
    for (const [channel, channelCreatives] of Object.entries(byChannel)) {
      const channelCopy = copyData.copies?.find((c) => c.channel === channel);
      const variations = channelCopy?.variations || [];

      for (let i = 0; i < channelCreatives.length; i++) {
        const creative = channelCreatives[i];
        const variation = variations[i % variations.length]; // 순환 매핑

        if (variation) {
          await updateCreative(creative.id as string, {
            copy_json: variation,
            status: "composed",
          });
        }
      }
    }

    await updateCampaign(campaignId, { status: "completed" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Compose error:", error);
    return NextResponse.json({ error: "합성 실패" }, { status: 500 });
  }
}
