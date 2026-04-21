import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/memory";
import { listCampaigns } from "@/lib/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteCampaignButton } from "@/components/campaign/DeleteCampaignButton";

export const dynamic = "force-dynamic";

export default async function CampaignsListPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const campaigns = await listCampaigns(brandId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">캠페인 {campaigns.length}개</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 브랜드</Button>
          </Link>
          <Link href={`/brands/${brandId}/campaigns/new`}>
            <Button>+ 새 캠페인</Button>
          </Link>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">등록된 캠페인이 없습니다</p>
            <Link href={`/brands/${brandId}/campaigns/new`}>
              <Button>첫 캠페인 시작</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="relative">
              <Link href={`/campaigns/${c.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2 pr-10">
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <Badge variant="secondary">{c.goal}</Badge>
                      <Badge variant="outline">{c.channel}</Badge>
                      <Badge
                        variant={c.status === "completed" ? "secondary" : "outline"}
                      >
                        {c.status}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
              <div className="absolute right-3 top-3">
                <DeleteCampaignButton
                  campaignId={c.id}
                  campaignName={c.name}
                  variant="icon"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
