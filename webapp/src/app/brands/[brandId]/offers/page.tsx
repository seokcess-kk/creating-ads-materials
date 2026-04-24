import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, getIdentity, listAudiences, listOffers } from "@/lib/memory";
import { OfferManager } from "@/components/memory/OfferManager";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const [offers, identity, audiences] = await Promise.all([
    listOffers(brandId),
    getIdentity(brandId),
    listAudiences(brandId),
  ]);

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Offers"
        description="USP·가격·혜택·긴급성·증거 — AI 초안으로 빠르게 시작"
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <OfferManager
        brandId={brandId}
        initial={offers}
        brand={brand}
        identity={identity}
        audiences={audiences}
      />
    </PageContainer>
  );
}
