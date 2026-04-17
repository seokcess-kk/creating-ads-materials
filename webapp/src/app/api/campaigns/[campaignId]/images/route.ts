import { NextResponse } from "next/server";
import { generateAdImage } from "@/lib/gemini/generate-image";
import { getCampaign } from "@/lib/db/campaigns";
import { createCreative, updateCreative } from "@/lib/db/creatives";
import { CHANNELS } from "@/lib/channels";

export const maxDuration = 300;

// 같은 채널에서 다양한 이미지를 생성하기 위한 변형 지시문
const VARIATION_PROMPTS = [
  "Focus on the overall environment and atmosphere of the space.",
  "Focus on a close-up detail shot that conveys quality and professionalism.",
  "Show people naturally interacting in the space, conveying warmth and community.",
  "Use dramatic lighting with strong contrast to create visual impact.",
  "Capture a wide-angle panoramic view that emphasizes the scale and sophistication.",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await request.json().catch(() => ({}));
    const countPerChannel = Math.min(body.countPerChannel || 1, 5);

    const campaign = await getCampaign(campaignId);
    const brief = campaign.brief_json as Record<string, unknown>;

    const imageDirection = (brief.image_prompt_direction as string) || "A professional commercial photograph";
    const results = [];

    for (const channelId of campaign.target_channels || []) {
      const channelConfig = CHANNELS.find((c) => c.id === channelId);
      if (!channelConfig) continue;

      for (let i = 0; i < countPerChannel; i++) {
        const variation = VARIATION_PROMPTS[i % VARIATION_PROMPTS.length];

        const prompt = `${imageDirection}. ${variation} This image is for a ${channelConfig.platform} advertisement. The composition should work well in ${channelConfig.aspectRatio} aspect ratio with space for text overlay at the top and bottom. Professional commercial photography, high quality, clean composition, no text, no letters, no watermark.`;

        try {
          const imageUrl = await generateAdImage(
            prompt,
            channelConfig.aspectRatio,
            campaignId,
            `bg_${channelId}_v${i + 1}.png`
          );

          const creative = await createCreative({
            campaignId,
            channel: channelId,
            aspectRatio: channelConfig.aspectRatio,
          });

          await updateCreative(creative.id, {
            bg_image_url: imageUrl,
            status: "images_done",
          });

          results.push({
            channelId,
            variation: i + 1,
            imageUrl,
            creativeId: creative.id,
          });
        } catch (err) {
          console.error(`Image generation failed for ${channelId} v${i + 1}:`, err);
          results.push({ channelId, variation: i + 1, error: "생성 실패" });
        }
      }
    }

    return NextResponse.json({ images: results });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json({ error: "이미지 생성 실패" }, { status: 500 });
  }
}
