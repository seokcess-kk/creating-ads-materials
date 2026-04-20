import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listAudiences } from "@/lib/memory";
import { AudienceManager } from "@/components/memory/AudienceManager";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AudiencesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const audiences = await listAudiences(brandId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Audiences</h1>
          <p className="text-muted-foreground">타겟 페르소나</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <AudienceManager brandId={brandId} initial={audiences} />
    </div>
  );
}
