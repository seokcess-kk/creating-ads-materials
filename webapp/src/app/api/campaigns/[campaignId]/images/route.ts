import { NextResponse } from "next/server";
import { generateAdImage } from "@/lib/gemini/generate-image";
import { getCampaign } from "@/lib/db/campaigns";
import { createCreative } from "@/lib/db/creatives";
import { CHANNELS } from "@/lib/channels";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    const brief = campaign.brief_json as Record<string, unknown>;

    const imageDirection = (brief.image_prompt_direction as string) || "A professional commercial photograph";
    const results = [];

    for (const channelId of campaign.target_channels || []) {
      const channelConfig = CHANNELS.find((c) => c.id === channelId);
      if (!channelConfig) continue;

      const prompt = `${imageDirection}. This image is for a ${channelConfig.platform} advertisement. The composition should work well in ${channelConfig.aspectRatio} aspect ratio with space for text overlay at the top and bottom. Professional commercial photography, high quality, clean composition, no text, no letters, no watermark.`;

      try {
        const imageUrl = await generateAdImage(
          prompt,
          channelConfig.aspectRatio,
          campaignId,
          `bg_${channelId}.png`
        );

        // creatives 레코드 생성
        const creative = await createCreative({
          campaignId,
          channel: channelId,
          aspectRatio: channelConfig.aspectRatio,
        });

        results.push({
          channelId,
          imageUrl,
          creativeId: creative.id,
        });
      } catch (err) {
        console.error(`Image generation failed for ${channelId}:`, err);
        results.push({ channelId, error: "생성 실패" });
      }
    }

    return NextResponse.json({ images: results });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: "이미지 생성 실패" }, { status: 500 });
  }
}
