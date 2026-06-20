import { z } from "zod";
import { getBrand } from "@/lib/memory";
import { createCampaign } from "@/lib/campaigns";
import { generateCardNews } from "@/lib/cardnews/generate";
import { upsertCardNews } from "@/lib/cardnews/queries";
import { CARDNEWS_PROMPT_VERSION } from "@/lib/prompts/cardnews";
import { ApiError, ok, parseJson, serverError } from "@/lib/api-utils";

export const maxDuration = 180;

const Schema = z.object({
  content: z.string().min(10).max(8000),
  tone: z.string().max(300).nullable().optional(),
  name: z.string().max(120).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    const input = await parseJson(request, Schema);

    const brand = await getBrand(brandId);
    if (!brand) throw new ApiError(404, "브랜드를 찾을 수 없습니다");

    const firstLine = input.content.trim().split("\n")[0].slice(0, 60).trim();
    const campaign = await createCampaign(brandId, {
      name: input.name?.trim() || firstLine || "카드뉴스",
      goal: "BOFU",
      offer_id: null,
      audience_id: null,
      channel: "ig_feed_square",
      content_mode: "notice",
      format: "carousel",
      raw_content: input.content.trim(),
      tone_override: input.tone?.trim() || null,
      automation_level: "auto",
    });

    const result = await generateCardNews(campaign, { brandName: brand.name });
    const record = await upsertCardNews(campaign.id, result, CARDNEWS_PROMPT_VERSION);

    return ok({ campaignId: campaign.id, carousel: record });
  } catch (e) {
    return serverError(e);
  }
}
