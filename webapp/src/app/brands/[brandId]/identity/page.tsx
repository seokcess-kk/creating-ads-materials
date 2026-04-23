import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, getIdentity } from "@/lib/memory";
import { IdentityForm } from "@/components/memory/IdentityForm";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

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
    <PageContainer size="narrow">
      <PageHeader
        title="Identity"
        description="보이스·금지어·컬러·로고"
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <IdentityForm
        brandId={brandId}
        initial={identity}
        brandWebsiteUrl={brand.website_url}
      />
    </PageContainer>
  );
}
