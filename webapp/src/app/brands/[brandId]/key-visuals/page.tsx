import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/memory";
import { listKeyVisuals } from "@/lib/memory/key-visuals";
import { KeyVisualManager } from "@/components/memory/KeyVisualManager";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function KeyVisualsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const keyVisuals = await listKeyVisuals(brandId);

  return (
    <PageContainer>
      <PageHeader
        title="Key Visuals (실사 자산)"
        description="브랜드 실제 공간·인물·제품 사진. 캠페인 생성 시 선택하면 이미지 변형 없이 그대로 광고 소재에 반영됩니다."
        overline={brand.name}
        actions={
          <Link href={`/brands/${brandId}`}>
            <Button variant="outline">← 대시보드</Button>
          </Link>
        }
      />
      <KeyVisualManager brandId={brandId} initial={keyVisuals} />
    </PageContainer>
  );
}
