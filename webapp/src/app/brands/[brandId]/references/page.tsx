import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listReferences } from "@/lib/memory";
import { ReferenceManager } from "@/components/memory/ReferenceManager";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ReferencesPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const references = await listReferences(brandId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">References (BP)</h1>
          <p className="text-muted-foreground">우수 사례 + Claude Vision 8축 자동 분석</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <ReferenceManager brandId={brandId} initial={references} />
    </div>
  );
}
