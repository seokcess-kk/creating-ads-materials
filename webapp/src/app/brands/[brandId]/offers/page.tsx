import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listOffers } from "@/lib/memory";
import { OfferManager } from "@/components/memory/OfferManager";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const offers = await listOffers(brandId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Offers</h1>
          <p className="text-muted-foreground">USP·가격·혜택·긴급성·증거</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <OfferManager brandId={brandId} initial={offers} />
    </div>
  );
}
