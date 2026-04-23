import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import {
  FilterChipGroup,
  type FilterOption,
} from "@/components/filters/FilterChipGroup";

export const dynamic = "force-dynamic";

type SortKey = "newest" | "name";

interface SearchParamsShape {
  q?: string;
  sort?: string;
}

function buildBrandsHref(
  current: SearchParamsShape,
  overrides: Partial<SearchParamsShape>,
): string {
  const merged: SearchParamsShape = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  const qs = params.toString();
  return qs ? `/brands?${qs}` : "/brands";
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sort: SortKey = sp.sort === "name" ? "name" : "newest";

  const all = await listBrands();
  const lower = q.toLowerCase();
  const filtered = lower
    ? all.filter((b) => {
        const hay = [b.name, b.category ?? "", b.description ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(lower);
      })
    : all;
  const visible =
    sort === "name"
      ? [...filtered].sort((a, b) => a.name.localeCompare(b.name, "ko"))
      : filtered;

  const sortChipOptions: FilterOption[] = [
    { id: "newest", label: "최신순" },
    { id: "name", label: "이름순" },
  ].map((o) => ({
    ...o,
    href: buildBrandsHref(sp, { sort: o.id === "newest" ? undefined : o.id }),
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Brands"
        description={`등록된 브랜드 ${all.length}개`}
        actions={
          <Link href="/brands/new">
            <Button>+ 새 브랜드</Button>
          </Link>
        }
      />

      {all.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <form method="GET" className="flex gap-2 flex-1 min-w-[240px]">
            <Input
              name="q"
              defaultValue={q}
              placeholder="이름·카테고리·설명 검색..."
              className="h-9"
            />
            {sort !== "newest" && (
              <input type="hidden" name="sort" value={sort} />
            )}
            <Button type="submit" variant="outline" size="sm">
              검색
            </Button>
            {q && (
              <Link href={buildBrandsHref(sp, { q: undefined })}>
                <Button type="button" variant="ghost" size="sm">
                  초기화
                </Button>
              </Link>
            )}
          </form>
          <FilterChipGroup
            options={sortChipOptions}
            activeId={sort}
            size="sm"
          />
        </div>
      )}

      {all.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="아직 등록된 브랜드가 없습니다"
          description="브랜드를 등록하면 Identity·Offer·Audience 메모리를 축적할 수 있습니다."
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
            <Link href={buildBrandsHref(sp, { q: undefined })}>
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
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full"
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{brand.name}</CardTitle>
                  {brand.website_url && (
                    <p className="text-xs text-muted-foreground truncate">{brand.website_url}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {brand.category && <p>카테고리: {brand.category}</p>}
                  {brand.description && <p className="line-clamp-2">{brand.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
