import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listFontPairs } from "@/lib/memory";
import { FontManager } from "@/components/memory/FontManager";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

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
    <PageContainer size="narrow">
      <PageHeader
        title="Fonts"
        description="역할별 폰트 조합 (Tier 0~3)"
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <FontManager brandId={brandId} initialPairs={pairs} />
    </PageContainer>
  );
}
