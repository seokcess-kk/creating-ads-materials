import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const brands = await listBrands().catch(() => []);

  return (
    <PageContainer>
      <PageHeader
        title="무엇을 만들까요?"
        description="이미지 한 장 또는 캐러셀을 바로 생성합니다."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/generate" className="block rounded-lg">
          <Card className="h-full transition-colors hover:border-foreground/30 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">단일 이미지</CardTitle>
              <CardDescription>
                컨셉·카피 입력 → 이미지 생성 → 다운로드
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                광고 이미지 한 장을 빠르게. 텍스트는 안정적인 한글 오버레이로 합성합니다.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/carousel" className="block rounded-lg">
          <Card className="h-full transition-colors hover:border-foreground/30 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">캐러셀</CardTitle>
              <CardDescription>
                원문 → 번들 기획 → 슬라이드별 상세 → 합성
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                전체 콘셉트·서사를 먼저 잡고 슬라이드를 구체화. 단계마다 검토·편집할 수 있습니다.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <Link href="/gallery" className="text-primary underline">
          최근 결과 보기 →
        </Link>
        <Link href="/brands" className="text-muted-foreground underline">
          브랜드 관리
        </Link>
      </div>

      {brands.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">브랜드</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.slice(0, 6).map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}`}
                className="block rounded-lg"
              >
                <Card className="transition-colors hover:border-foreground/30 cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    {b.category && (
                      <CardDescription className="text-xs">
                        {b.category}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
