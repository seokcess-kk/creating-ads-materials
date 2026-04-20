import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listBrands } from "@/lib/memory";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await listBrands();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="text-muted-foreground">등록된 브랜드 목록</p>
        </div>
        <Link href="/brands/new">
          <Button>+ 새 브랜드</Button>
        </Link>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">등록된 브랜드가 없습니다</p>
            <Link href="/brands/new">
              <Button>첫 브랜드 등록하기</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
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
    </div>
  );
}
