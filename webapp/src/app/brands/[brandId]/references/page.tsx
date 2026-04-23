import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listReferences } from "@/lib/memory";
import { ReferenceManager } from "@/components/memory/ReferenceManager";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

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
    <PageContainer>
      <PageHeader
        title="References (BP)"
        description="우수 사례 + Claude Vision 8축 자동 분석"
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <ReferenceManager brandId={brandId} initial={references} />
    </PageContainer>
  );
}
