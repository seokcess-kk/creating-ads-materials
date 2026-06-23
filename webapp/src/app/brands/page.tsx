import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export const dynamic = "force-dynamic";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const all = await listBrands();
  const lower = q.toLowerCase();
  const visible = lower
    ? all.filter((b) =>
        [b.name, b.category ?? "", b.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(lower),
      )
    : all;

  return (
    <PageContainer>
      <PageHeader
        title="브랜드"
        description={`등록된 브랜드 ${all.length}개 — 생성 시 선택적으로 사용하는 컨텍스트`}
        actions={
          <Link href="/brands/new">
            <Button>새 브랜드</Button>
          </Link>
        }
      />

      {all.length > 0 && (
        <form method="GET" className="flex max-w-md gap-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder="이름·카테고리·설명 검색..."
            className="h-9"
          />
          <Button type="submit" variant="outline" size="sm">
            검색
          </Button>
          {q && (
            <Link href="/brands">
              <Button type="button" variant="ghost" size="sm">
                초기화
              </Button>
            </Link>
          )}
        </form>
      )}

      {all.length === 0 ? (
        <EmptyState
          title="아직 등록된 브랜드가 없습니다"
          description="브랜드를 등록하면 생성 시 컬러·로고 등 컨텍스트로 쓸 수 있습니다(선택)."
          action={
            <Link href="/brands/new">
              <Button>첫 브랜드 등록하기</Button>
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title={`"${q}" 검색 결과 없음`}
          description="다른 키워드로 검색하거나 초기화해 보세요."
          action={
            <Link href="/brands">
              <Button variant="outline" size="sm">
                검색 초기화
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.id}`}
              className="block h-full rounded-lg"
            >
              <Card className="h-full transition-colors hover:border-foreground/30 cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{brand.name}</CardTitle>
                  {brand.website_url && (
                    <p className="truncate text-xs text-muted-foreground">
                      {brand.website_url}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {brand.category && <p>카테고리: {brand.category}</p>}
                  {brand.description && (
                    <p className="line-clamp-2">{brand.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
