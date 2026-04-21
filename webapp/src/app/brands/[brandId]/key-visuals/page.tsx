import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand } from "@/lib/memory";
import { listKeyVisuals } from "@/lib/memory/key-visuals";
import { KeyVisualManager } from "@/components/memory/KeyVisualManager";
import { Button } from "@/components/ui/button";

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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Key Visuals (실사 자산)</h1>
          <p className="text-muted-foreground text-sm">
            브랜드 실제 공간·인물·제품 사진. 캠페인 생성 시 선택하면 이미지 변형 없이 그대로 광고 소재에 반영됩니다.
          </p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 대시보드</Button>
        </Link>
      </div>
      <KeyVisualManager brandId={brandId} initial={keyVisuals} />
    </div>
  );
}
