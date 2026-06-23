import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import { GenerateStudio } from "@/components/generate/GenerateStudio";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  const brands = await listBrands();

  return (
    <PageContainer size="narrow">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">단일 이미지 생성</h1>
        <p className="text-muted-foreground">
          컨셉과 카피만 입력하면 바로 광고 이미지를 만들고 다운로드합니다.
        </p>
      </div>
      <GenerateStudio brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
    </PageContainer>
  );
}
