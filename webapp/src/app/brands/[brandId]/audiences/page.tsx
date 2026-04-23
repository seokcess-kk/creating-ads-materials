import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, listAudiences } from "@/lib/memory";
import { AudienceManager } from "@/components/memory/AudienceManager";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

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
    <PageContainer size="narrow">
      <PageHeader
        title="Audiences"
        description="타겟 페르소나"
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <AudienceManager brandId={brandId} initial={audiences} />
    </PageContainer>
  );
}
