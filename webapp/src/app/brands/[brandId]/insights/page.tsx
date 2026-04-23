import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, loadBrandMemory } from "@/lib/memory";
import { listCampaigns } from "@/lib/campaigns";
import { recomputeLearnings, topN } from "@/lib/learning";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarList } from "@/components/insights/BarList";
import { RecomputeButton } from "@/components/insights/RecomputeButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatKst } from "@/lib/format/date";

export const dynamic = "force-dynamic";

interface PatternsShape {
  focusCounts?: Record<string, number>;
  logoPositionCounts?: Record<string, number>;
  retouchCategoryCounts?: Record<string, number>;
  roleCounts?: Record<string, number>;
  retouchUsageRate?: number;
  retouchTurnsPerRun?: number;
  completedRuns?: number;
  totalRuns?: number;
  avgRating?: number | null;
  ratedCount?: number;
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();

  let memory = await loadBrandMemory(brandId);
  if (memory && !memory.learnings) {
    try {
      await recomputeLearnings(brandId);
      memory = await loadBrandMemory(brandId);
    } catch {}
  }

  const campaigns = await listCampaigns(brandId);
  const learnings = memory?.learnings ?? null;

  const hookItems = learnings
    ? topN(learnings.hook_win_rates_json as Record<string, number>, 10)
    : [];
  const fwItems = learnings
    ? topN(learnings.framework_win_rates_json as Record<string, number>, 10)
    : [];
  const patterns = (learnings?.visual_patterns_json ?? {}) as PatternsShape;
  const focusItems = patterns.focusCounts ? topN(patterns.focusCounts, 10) : [];
  const logoItems = patterns.logoPositionCounts
    ? topN(patterns.logoPositionCounts, 10)
    : [];
  const retouchItems = patterns.retouchCategoryCounts
    ? topN(patterns.retouchCategoryCounts, 10)
    : [];
  const roleItems = patterns.roleCounts ? topN(patterns.roleCounts, 3) : [];

  const completed = patterns.completedRuns ?? 0;
  const totalRuns = patterns.totalRuns ?? 0;
  const avgRating = patterns.avgRating ?? null;
  const ratedCount = patterns.ratedCount ?? 0;
  const retouchRate = patterns.retouchUsageRate ?? 0;

  const references = memory?.references ?? [];
  const refReady = references.filter((r) => r.vision_status === "ready").length;
  const archiveCount = references.filter((r) => r.source_type === "own_archive").length;

  return (
    <PageContainer>
      <PageHeader
        title="Insights"
        description="선호도 학습 현황"
        overline={
          <Link href={`/brands/${brandId}`} className="hover:underline">
            {brand.name}
          </Link>
        }
        actions={
          <>
            <Link href={`/brands/${brandId}`}>
              <Button variant="outline">← 대시보드</Button>
            </Link>
            <RecomputeButton brandId={brandId} />
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>캠페인</CardDescription>
            <CardTitle className="text-2xl">{campaigns.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            실행 {totalRuns} · 완료 {completed}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>평균 평점</CardDescription>
            <CardTitle className="text-2xl">
              {avgRating != null ? `${avgRating.toFixed(1)}/5` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {ratedCount}개 평가됨
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Retouch 사용률</CardDescription>
            <CardTitle className="text-2xl">{(retouchRate * 100).toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            평균 {(patterns.retouchTurnsPerRun ?? 0).toFixed(1)}턴
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Brand References</CardDescription>
            <CardTitle className="text-2xl">{references.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            분석 완료 {refReady} · 자사 승격 {archiveCount}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">훅 선호도</CardTitle>
            <CardDescription className="text-xs">
              선택된 Strategy의 hookType 분포
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Hook type"
              items={hookItems}
              emptyLabel="아직 선택된 전략이 없습니다"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">프레임워크 선호도</CardTitle>
            <CardDescription className="text-xs">
              선택된 Strategy의 frameworkId 분포
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Framework"
              items={fwItems}
              emptyLabel="아직 선택된 전략이 없습니다"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">비주얼 포커스</CardTitle>
            <CardDescription className="text-xs">
              선택된 Visual variant의 focus 분포
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Focus"
              items={focusItems}
              emptyLabel="아직 선택된 비주얼이 없습니다"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">로고 배치 분포</CardTitle>
            <CardDescription className="text-xs">
              확정된 Compose의 로고 위치
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Logo position"
              items={logoItems}
              emptyLabel="아직 Compose된 소재가 없습니다"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">전략 역할 선택률</CardTitle>
            <CardDescription className="text-xs">
              Safe(검증) · Explore(탐색) · Challenge(도전) 중 어느 방향을 선택했는지
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Role"
              items={roleItems}
              emptyLabel="아직 선택된 전략이 없습니다"
              color="accent"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">자주 수정한 영역 (Retouch)</CardTitle>
            <CardDescription className="text-xs">
              Retouch 지시문 카테고리 — 다음 생성 시 선제 반영
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              title="Retouch category"
              items={retouchItems}
              emptyLabel="Retouch 기록이 없습니다"
              color="accent"
            />
          </CardContent>
        </Card>
      </div>

      {!learnings ||
        (completed === 0 && hookItems.length === 0 && (
          <Card className="bg-muted/30">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              첫 캠페인을 완료하면 이곳에 선호도 패턴이 누적됩니다.{" "}
              <Link href={`/brands/${brandId}/campaigns/new`} className="underline">
                캠페인 시작
              </Link>
            </CardContent>
          </Card>
        ))}

      {learnings?.computed_at && (
        <p className="text-[11px] text-muted-foreground text-right">
          마지막 재계산: {formatKst(learnings.computed_at)}
        </p>
      )}

      <Card className="bg-muted/30">
        <CardContent className="py-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium">📊 안내</p>
          <p>
            향후 성과 데이터(CTR·CVR·CPC)를 입력하면 위 선호도 가중치가 실제 성과로 캘리브레이션됩니다.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
