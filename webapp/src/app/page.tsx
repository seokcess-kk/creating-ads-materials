import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listBrands } from "@/lib/memory";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const brands = await listBrands();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Creative System — Brand Memory 중심</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Brands</CardDescription>
            <CardTitle className="text-3xl">{brands.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/brands/new">
              <Button variant="outline" size="sm">+ 브랜드</Button>
            </Link>
            <Link href="/brands">
              <Button variant="ghost" size="sm">보기</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Campaigns</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">M2에서 활성화</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Creatives</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">—</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">M3에서 활성화</p>
          </CardContent>
        </Card>
      </div>

      {brands.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">최근 브랜드</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.slice(0, 6).map((b) => (
              <Link key={b.id} href={`/brands/${b.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    {b.category && (
                      <CardDescription className="text-xs">{b.category}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
