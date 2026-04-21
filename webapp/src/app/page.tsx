import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listBrands } from "@/lib/memory";
import { getDashboardStats } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [brands, stats] = await Promise.all([listBrands(), getDashboardStats()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Creative System — Brand Memory 중심</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/brands" className="group">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Brands</CardDescription>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <CardTitle className="text-3xl">{brands.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                브랜드 메모리 — Identity · Offer · Audience
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/campaigns" className="group">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Campaigns</CardDescription>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <CardTitle className="text-3xl">{stats.campaigns}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                진행 중 {stats.running} · 완료 {stats.completed}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/campaigns?status=completed" className="group">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>완료된 소재</CardDescription>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <CardTitle className="text-3xl">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Ship 단계까지 완주한 캠페인
              </p>
            </CardContent>
          </Card>
        </Link>
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
