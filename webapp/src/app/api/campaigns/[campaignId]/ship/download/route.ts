import {
  getCampaign,
  getLatestRun,
  getSelectedVariant,
} from "@/lib/campaigns";
import { ApiError, serverError } from "@/lib/api-utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params;
    const campaign = await getCampaign(campaignId);
    if (!campaign) throw new ApiError(404, "캠페인 없음");

    const run = await getLatestRun(campaignId);
    if (!run) throw new ApiError(404, "실행 없음");
    const compose = await getSelectedVariant(run.id, "compose");
    if (!compose) throw new ApiError(404, "선택된 Compose 없음");

    const url = (compose.content_json as { url?: string }).url;
    if (!url) throw new ApiError(404, "Compose URL 없음");

    const res = await fetch(url);
    if (!res.ok) throw new ApiError(502, `이미지 fetch 실패 ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const rawName = campaign.name
      .replace(/[^\w가-힣_-]+/g, "_")
      .slice(0, 60);
    const utf8Filename = `${rawName}_${campaignId.slice(0, 8)}.png`;
    const asciiFallback =
      (rawName.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "creative") +
      `_${campaignId.slice(0, 8)}.png`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
