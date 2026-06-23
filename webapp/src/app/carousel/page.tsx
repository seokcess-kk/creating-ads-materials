import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import { CarouselStudio } from "@/components/carousel/CarouselStudio";

export const dynamic = "force-dynamic";

export default async function CarouselPage() {
  const brands = await listBrands();

  return (
    <PageContainer size="narrow">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">캐러셀 만들기</h1>
        <p className="text-muted-foreground">
          원문 → 번들 기획(콘셉트·서사) → 슬라이드별 상세 → 합성. 단계마다 검토·편집할 수 있습니다.
        </p>
      </div>
      <CarouselStudio brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
    </PageContainer>
  );
}
