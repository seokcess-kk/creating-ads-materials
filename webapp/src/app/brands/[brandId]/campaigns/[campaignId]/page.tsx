import { getCampaign } from "@/lib/db/campaigns";
import { getCreatives } from "@/lib/db/creatives";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANNELS } from "@/lib/channels";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ brandId: string; campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  const creatives = await getCreatives(campaignId);

  const brief = campaign.brief_json as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
        <p className="text-muted-foreground">{campaign.description}</p>
        <Badge variant={campaign.status === "completed" ? "default" : "secondary"} className="mt-2">
          {campaign.status}
        </Badge>
      </div>

      {/* 브리프 요약 */}
      {Boolean(brief.campaign_concept) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">크리에이티브 브리프</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>콘셉트:</strong> {brief.campaign_concept as string}</p>
            <p><strong>톤앤매너:</strong> {brief.tone_and_manner as string}</p>
            <p><strong>핵심 메시지:</strong> {brief.key_message as string}</p>
            <p><strong>CTA:</strong> {brief.cta as string}</p>
          </CardContent>
        </Card>
      )}

      {/* 생성된 소재 */}
      <div>
        <h2 className="text-lg font-medium mb-4">생성된 소재 ({creatives.length}개)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {creatives.map((creative: Record<string, unknown>) => {
            const channelConfig = CHANNELS.find((c) => c.id === creative.channel);
            const copy = creative.copy_json as Record<string, string> | undefined;

            return (
              <Card key={creative.id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {channelConfig?.label || (creative.channel as string)}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {creative.aspect_ratio as string}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Boolean(creative.file_url || creative.bg_image_url) && (
                    <img
                      src={(creative.file_url || creative.bg_image_url) as string}
                      alt={creative.file_url ? "완성형 소재" : "배경 이미지"}
                      className="rounded-lg w-full"
                    />
                  )}
                  {Boolean(creative.file_url && creative.bg_image_url) && (
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer">배경 원본 보기</summary>
                      <img src={creative.bg_image_url as string} alt="배경 원본" className="rounded-lg w-full mt-2" />
                    </details>
                  )}

                  {copy && (
                    <div className="text-sm space-y-1 p-3 bg-muted/50 rounded">
                      {copy.headline && <p className="font-bold">{copy.headline}</p>}
                      {copy.sub_copy && <p className="text-muted-foreground">{copy.sub_copy}</p>}
                      {copy.cta && (
                        <Badge variant="secondary">{copy.cta}</Badge>
                      )}
                    </div>
                  )}

                  <Badge
                    variant={creative.status === "composed" || creative.status === "approved" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {creative.status as string}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
