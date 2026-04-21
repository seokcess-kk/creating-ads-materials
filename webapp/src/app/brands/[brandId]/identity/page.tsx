import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, getIdentity } from "@/lib/memory";
import { IdentityForm } from "@/components/memory/IdentityForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const identity = await getIdentity(brandId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Identity</h1>
          <p className="text-muted-foreground">보이스·금지어·컬러·로고</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <IdentityForm
        brandId={brandId}
        initial={identity}
        brandWebsiteUrl={brand.website_url}
      />
    </div>
  );
}
