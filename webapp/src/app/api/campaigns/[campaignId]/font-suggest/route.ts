import { getCampaign } from "@/lib/campaigns";
import { getBrand, loadBrandMemory } from "@/lib/memory";
import { suggestFontPresetsForCampaign } from "@/lib/fonts/suggest-for-campaign";
import { ApiError, ok, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인을 찾을 수 없습니다");

    const [memory, brand] = await Promise.all([
      loadBrandMemory(campaign.brand_id),
      getBrand(campaign.brand_id),
    ]);
    if (!memory) throw new ApiError(404, "브랜드 메모리를 찾을 수 없습니다");

    const suggestions = suggestFontPresetsForCampaign({
      memory,
      brandCategory: brand?.category ?? null,
    });

    return ok({ suggestions });
  } catch (e) {
    return serverError(e);
  }
}
