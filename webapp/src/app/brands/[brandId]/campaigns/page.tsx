import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/memory";
import { listCampaigns } from "@/lib/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteCampaignButton } from "@/components/campaign/DeleteCampaignButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

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
    <PageContainer size="narrow">
      <PageHeader
        title="Campaigns"
        description={`캠페인 ${campaigns.length}개`}
        overline={brand.name}
        actions={
          <>
            <Link href={`/brands/${brandId}`}>
              <Button variant="outline">← 브랜드</Button>
            </Link>
            <Link href={`/brands/${brandId}/campaigns/new`}>
              <Button>+ 새 캠페인</Button>
            </Link>
          </>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon="🚀"
          title="등록된 캠페인이 없습니다"
          description="Intent 입력 → Strategy·Copy·Visual 파이프라인으로 첫 캠페인을 시작하세요."
          action={
            <Link href={`/brands/${brandId}/campaigns/new`}>
              <Button>첫 캠페인 시작</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="relative">
              <Link
                href={`/campaigns/${c.id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
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
    </PageContainer>
  );
}
