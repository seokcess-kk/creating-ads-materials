import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrand } from "@/lib/memory";
import { CardNewsStudio } from "@/components/cardnews/CardNewsStudio";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CardNewsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">카드뉴스 생성</h1>
          <p className="text-muted-foreground">
            원문을 붙여넣으면 카드뉴스(캐러셀) 초안이 자동 생성됩니다
          </p>
        </div>
        <Link href={`/brands/${brandId}`}>
          <Button variant="outline">← 돌아가기</Button>
        </Link>
      </div>
      <CardNewsStudio brandId={brandId} />
    </div>
  );
}
