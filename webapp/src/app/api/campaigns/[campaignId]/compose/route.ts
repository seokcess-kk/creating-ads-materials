import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/db/campaigns";
import { getBrand } from "@/lib/db/brands";
import { createCreative } from "@/lib/db/creatives";
import { composeAd } from "@/lib/canvas/compositor";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

interface ComposeCombination {
  creativeId?: string;
  copy: {
    headline?: string;
    sub_copy?: string;
    cta?: string;
    angle?: string;
  };
  backgroundImageUrl: string;
  channel: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const combinations: ComposeCombination[] = body.combinations || [];

    if (combinations.length === 0) {
      return NextResponse.json({ error: "합성할 조합이 없습니다" }, { status: 400 });
    }

    const campaign = await getCampaign(campaignId);
    const brand = await getBrand(campaign.brand_id);

    // 브랜드 컬러 조회
    const supabase = createAdminClient();
    const { data: brandColors } = await supabase
      .from("brand_colors")
      .select("*")
      .eq("brand_id", brand.id)
      .order("sort_order");

    const getColor = (role: string, fallback: string) =>
      brandColors?.find((c: { role: string }) => c.role === role)?.hex || fallback;

    const secondaryColor = getColor("secondary", "#D4AF37");
    const textColor = getColor("text", "#FFFFFF");
    const ctaBg = getColor("cta_bg", secondaryColor);
    const ctaText = getColor("cta_text", getColor("primary", "#1A2335"));

    // 로고 조회
    const { data: logos } = await supabase
      .from("brand_assets")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("asset_category", "logo");
    const logoUrl = logos?.[0]?.file_url || null;

    // 슬로건
    const styleGuide = brand.style_guide_json as Record<string, unknown>;
    const slogan = (styleGuide?.slogan as string) || "";

    const results = [];

    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];

      try {
        const composedUrl = await composeAd({
          backgroundImageUrl: combo.backgroundImageUrl,
          output: {
            bucket: "creatives",
            path: `${campaignId}/final_${combo.channel}_${i + 1}.png`,
          },
          overlay: { top: true, topOpacity: 180, bottom: true, bottomOpacity: 220 },
          logo: logoUrl ? { url: logoUrl, position: "top-left", widthRatio: 0.12, yRatio: 0.03 } : undefined,
          brand: !logoUrl ? { text: brand.name, color: textColor, sizeRatio: 0.024 } : undefined,
          mainCopy: combo.copy.headline ? {
            text: combo.copy.headline,
            color: textColor,
            sizeRatio: 0.048,
            yRatio: 0.12,
            lineSpacingRatio: 0.065,
            center: true,
          } : undefined,
          subCopy: combo.copy.sub_copy ? {
            text: combo.copy.sub_copy,
            color: secondaryColor,
            sizeRatio: 0.026,
            yRatio: 0.80,
            center: true,
          } : undefined,
          cta: combo.copy.cta ? {
            text: combo.copy.cta,
            bgColor: ctaBg,
            textColor: ctaText,
            sizeRatio: 0.028,
            yRatio: 0.86,
          } : undefined,
          slogan: slogan ? {
            text: slogan,
            color: "#999999",
            sizeRatio: 0.018,
            yRatio: 0.94,
          } : undefined,
        });

        // 새 creative 레코드 생성
        const creative = await createCreative({
          campaignId,
          channel: combo.channel,
          aspectRatio: CHANNELS_MAP[combo.channel] || "1:1",
        });

        await supabase
          .from("creatives")
          .update({
            file_url: composedUrl,
            bg_image_url: combo.backgroundImageUrl,
            copy_json: combo.copy,
            status: "composed",
          })
          .eq("id", creative.id);

        results.push({ index: i, composedUrl, creativeId: creative.id });
      } catch (err) {
        console.error(`Compose failed for combo ${i}:`, err);
        results.push({ index: i, error: String(err) });
      }
    }

    await updateCampaign(campaignId, { status: "completed" });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Compose error:", error);
    return NextResponse.json({ error: "합성 실패" }, { status: 500 });
  }
}

// 채널 ID → aspect ratio 매핑
const CHANNELS_MAP: Record<string, string> = {
  ig_feed_square: "1:1",
  ig_feed_vertical: "4:5",
  ig_story: "9:16",
  fb_feed_square: "1:1",
  fb_feed_landscape: "16:9",
  tiktok: "9:16",
  banner_medium: "4:3",
  banner_leaderboard: "16:9",
};
