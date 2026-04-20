import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listFontPairs } from "@/lib/memory";
import { FontManager } from "@/components/memory/FontManager";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function FontsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const pairs = await listFontPairs(brandId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Fonts</h1>
          <p className="text-muted-foreground">역할별 폰트 조합 (Tier 0~3)</p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <FontManager brandId={brandId} initialPairs={pairs} />
    </div>
  );
}
