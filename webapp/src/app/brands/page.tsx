import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getBrands } from "@/lib/db/brands";

export default async function BrandsPage() {
  const brands = await getBrands();

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
          {brands.map((brand: { id: string; name: string; website_url: string | null; style_guide_json: Record<string, unknown>; created_at: string }) => (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{brand.name}</CardTitle>
                  {brand.website_url && (
                    <p className="text-xs text-muted-foreground truncate">{brand.website_url}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {Object.keys(brand.style_guide_json || {}).length > 0 ? (
                      <Badge variant="secondary">스타일 가이드 완료</Badge>
                    ) : (
                      <Badge variant="outline">분석 전</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
