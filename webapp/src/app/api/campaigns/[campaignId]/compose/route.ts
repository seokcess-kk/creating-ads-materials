import { NextResponse } from "next/server";
import { getCampaign, updateCampaign } from "@/lib/db/campaigns";
import { getBrand } from "@/lib/db/brands";
import { getCreatives, updateCreative } from "@/lib/db/creatives";
import { composeAd } from "@/lib/canvas/compositor";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    const brand = await getBrand(campaign.brand_id);
    const creatives = await getCreatives(campaignId);
    const copyData = campaign.copy_json as {
      copies?: Array<{
        channel: string;
        variations: Array<Record<string, string>>;
      }>;
    };

    // 브랜드 컬러 조회
    const supabase = createAdminClient();
    const { data: brandColors } = await supabase
      .from("brand_colors")
      .select("*")
      .eq("brand_id", brand.id)
      .order("sort_order");

    const primaryColor = brandColors?.find((c: { role: string }) => c.role === "primary")?.hex || "#1A2335";
    const secondaryColor = brandColors?.find((c: { role: string }) => c.role === "secondary")?.hex || "#D4AF37";
    const textColor = brandColors?.find((c: { role: string }) => c.role === "text")?.hex || "#FFFFFF";
    const ctaBg = brandColors?.find((c: { role: string }) => c.role === "cta_bg")?.hex || secondaryColor;
    const ctaText = brandColors?.find((c: { role: string }) => c.role === "cta_text")?.hex || primaryColor;

    // 로고 조회 (어두운 배경용 우선)
    const { data: logos } = await supabase
      .from("brand_assets")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("asset_category", "logo");

    const logoAsset = logos?.[0];
    const logoUrl = logoAsset?.file_url || null;

    // 브리프에서 슬로건 추출
    const styleGuide = brand.style_guide_json as Record<string, unknown>;
    const slogan = (styleGuide?.slogan as string) || "";

    // 채널별 크리에이티브 그룹화
    const byChannel: Record<string, typeof creatives> = {};
    for (const creative of creatives) {
      const ch = creative.channel as string;
      if (!byChannel[ch]) byChannel[ch] = [];
      byChannel[ch].push(creative);
    }

    // 각 크리에이티브에 대해 합성 실행
    for (const [channel, channelCreatives] of Object.entries(byChannel)) {
      const channelCopy = copyData.copies?.find((c) => c.channel === channel);
      const variations = channelCopy?.variations || [];

      for (let i = 0; i < channelCreatives.length; i++) {
        const creative = channelCreatives[i];
        const bgUrl = creative.bg_image_url as string;

        if (!bgUrl) continue;

        const variation = variations[i % Math.max(variations.length, 1)];
        const headline = variation?.headline || "";
        const subCopy = variation?.sub_copy || "";
        const cta = variation?.cta || "";

        try {
          const composedUrl = await composeAd({
            backgroundImageUrl: bgUrl,
            output: {
              bucket: "creatives",
              path: `${campaignId}/final_${channel}_v${i + 1}.png`,
            },
            overlay: {
              top: true,
              topOpacity: 180,
              bottom: true,
              bottomOpacity: 220,
            },
            logo: logoUrl ? {
              url: logoUrl,
              position: "top-left",
              widthRatio: 0.12,
              yRatio: 0.03,
            } : undefined,
            brand: !logoUrl ? {
              text: brand.name,
              color: textColor,
              sizeRatio: 0.024,
            } : undefined,
            mainCopy: headline ? {
              text: headline,
              color: textColor,
              sizeRatio: 0.048,
              yRatio: 0.12,
              lineSpacingRatio: 0.065,
              center: true,
            } : undefined,
            subCopy: subCopy ? {
              text: subCopy,
              color: secondaryColor,
              sizeRatio: 0.026,
              yRatio: 0.80,
              center: true,
            } : undefined,
            cta: cta ? {
              text: cta,
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

          await updateCreative(creative.id as string, {
            file_url: composedUrl,
            copy_json: variation || {},
            status: "composed",
          });
        } catch (err) {
          console.error(`Compose failed for ${channel} v${i + 1}:`, err);
          // 합성 실패해도 카피는 저장
          await updateCreative(creative.id as string, {
            copy_json: variation || {},
            status: "images_done",
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
