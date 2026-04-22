import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listAudiences, listOffers } from "@/lib/memory";
import { listKeyVisuals } from "@/lib/memory/key-visuals";
import { IntentForm } from "@/components/campaign/IntentForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const [offers, audiences, keyVisuals] = await Promise.all([
    listOffers(brandId),
    listAudiences(brandId),
    listKeyVisuals(brandId),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">새 캠페인</h1>
          <p className="text-muted-foreground">채널·오퍼·타겟을 선택하면 Strategy 단계가 시작됩니다</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 돌아가기</Button>
        </Link>
      </div>
      <IntentForm
        brandId={brandId}
        brandName={brand.name}
        offers={offers}
        audiences={audiences}
        keyVisuals={keyVisuals}
        usesRealAssets={brand.uses_real_assets}
      />
    </div>
  );
}
