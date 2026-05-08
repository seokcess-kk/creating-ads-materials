import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listBrands, listBrandsWithMemoryGaps } from "@/lib/memory";
import { getDashboardStats, listRecentShippedRuns } from "@/lib/campaigns";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatKst } from "@/lib/format/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [brands, stats, shippedRuns, memoryGaps] = await Promise.all([
    listBrands(),
    getDashboardStats(),
    listRecentShippedRuns(5),
    listBrandsWithMemoryGaps(5),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Creative System — Brand Memory 중심"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/brands" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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

        <Link href="/campaigns" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
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
                진행 중 소재 {stats.runningMaterials} · ship 완료 {stats.shippedMaterials}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/campaigns?status=completed" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Card className="h-full hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>완료된 소재</CardDescription>
                <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <CardTitle className="text-3xl">{stats.shippedMaterials}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Ship 단계까지 완주한 소재
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div
        className={
          memoryGaps.length > 0
            ? "grid grid-cols-1 gap-6 lg:grid-cols-2"
            : "space-y-3"
        }
      >
        {/* 메모리 갭 — 막힌 브랜드 알림 (갭이 있을 때만 노출) */}
        {memoryGaps.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                브랜드 메모리 갭
              </h2>
              <p className="text-xs text-muted-foreground">
                캠페인 시작 전에 채워야 할 항목
              </p>
            </div>
            <div className="space-y-2">
              {memoryGaps.map((gap) => (
                <Link
                  key={gap.id}
                  href={`/brands/${gap.id}`}
                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="transition-colors hover:border-primary/50 cursor-pointer">
                    <CardContent className="flex items-center justify-between gap-2 py-3">
                      <span className="truncate text-sm font-medium">
                        {gap.name}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        {gap.needsIdentity && (
                          <Badge variant="outline" className="text-[10px]">
                            Identity 필요
                          </Badge>
                        )}
                        {gap.needsOffer && (
                          <Badge variant="outline" className="text-[10px]">
                            Offer 필요
                          </Badge>
                        )}
                        {gap.needsAudience && (
                          <Badge variant="outline" className="text-[10px]">
                            Audience 필요
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 최근 ship된 소재 — 갭 없을 때 풀 폭 그리드, 있을 때 우측 컬럼 */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              최근 ship된 소재
            </h2>
            <p className="text-xs text-muted-foreground">
              Ship 단계까지 완주한 최근 5개
            </p>
          </div>
          {shippedRuns.length === 0 ? (
            <Card className="bg-muted/20">
              <CardContent className="py-6 text-center text-xs text-muted-foreground">
                아직 ship된 소재가 없습니다
              </CardContent>
            </Card>
          ) : (
            <div
              className={
                memoryGaps.length === 0
                  ? "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
                  : "space-y-2"
              }
            >
              {shippedRuns.map((m) => (
                <Link
                  key={m.runId}
                  href={`/campaigns/${m.campaignId}?run=${m.runId}`}
                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full transition-colors hover:border-primary/50 cursor-pointer">
                    <CardContent className="space-y-1 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {m.runLabel ?? "소재"}
                        </span>
                        {m.rating != null && (
                          <span
                            className="shrink-0 text-[10px] text-amber-500"
                            aria-label={`평점 ${m.rating}`}
                          >
                            {"★".repeat(m.rating)}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {m.brandName} · {m.campaignName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatKst(m.completedAt, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {brands.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3">최근 브랜드</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.slice(0, 6).map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
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
    </PageContainer>
  );
}
