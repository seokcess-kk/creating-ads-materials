import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBrandMemory } from "@/lib/memory";
import { listCampaigns } from "@/lib/campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteBrandButton } from "@/components/brand/DeleteBrandButton";
import { BrandInfoEditButton } from "@/components/brand/BrandInfoEditButton";
import { MoreActionsMenu } from "@/components/common/MoreActionsMenu";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageTabs, type PageTabItem } from "@/components/layout/PageTabs";
import { EmptyState } from "@/components/common/EmptyState";

export const dynamic = "force-dynamic";

type TabKey = "memory" | "campaigns";

export default async function BrandDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { brandId } = await params;
  const { tab: tabParam } = await searchParams;
  const memory = await loadBrandMemory(brandId);
  if (!memory) notFound();
  const campaigns = await listCampaigns(brandId);

  const activeTab: TabKey = tabParam === "campaigns" ? "campaigns" : "memory";

  const { brand, identity, offers, audiences, references, keyVisuals, fontPairs } = memory;
  const memoryReady = Boolean(identity) && offers.length > 0 && audiences.length > 0;
  const readyRefs = references.filter((r) => r.vision_status === "ready").length;
  const pendingRefs = references.filter((r) => r.vision_status === "pending").length;
  const failedRefs = references.filter((r) => r.vision_status === "failed").length;
  const kvByKind = {
    space: keyVisuals.filter((k) => k.kind === "space").length,
    person: keyVisuals.filter((k) => k.kind === "person").length,
    product: keyVisuals.filter((k) => k.kind === "product").length,
  };

  type SectionGroup = "required" | "boosters" | "optional";
  interface Section {
    title: string;
    description: string;
    href: string;
    status: string;
    done: boolean;
    detail: string;
    group: SectionGroup;
  }

  const sections: Section[] = [
    {
      title: "Identity",
      description: "보이스·금지어·컬러·로고",
      href: `/brands/${brandId}/identity`,
      status: identity ? "설정 완료" : "미설정",
      done: Boolean(identity),
      detail: identity
        ? `${identity.colors_json.length} 컬러 · ${identity.taboos.length} 금지어`
        : "보이스·컬러를 설정하세요",
      group: "required",
    },
    {
      title: "Offers",
      description: "USP·가격·혜택·긴급성",
      href: `/brands/${brandId}/offers`,
      status: `${offers.length}개`,
      done: offers.length > 0,
      detail: offers[0]?.title ?? "오퍼를 등록하세요",
      group: "required",
    },
    {
      title: "Audiences",
      description: "타겟 페르소나",
      href: `/brands/${brandId}/audiences`,
      status: `${audiences.length}개`,
      done: audiences.length > 0,
      detail: audiences[0]?.persona_name ?? "페르소나를 정의하세요",
      group: "required",
    },
    {
      title: "References (BP)",
      description: "우수작 + 8축 Vision 분석",
      href: `/brands/${brandId}/references`,
      status: `${readyRefs}/${references.length} 분석`,
      done: readyRefs > 0,
      detail:
        references.length === 0
          ? "레퍼런스를 업로드하세요"
          : `대기 ${pendingRefs} · 실패 ${failedRefs}`,
      group: "boosters",
    },
    {
      title: "Fonts",
      description: "역할별 폰트 조합",
      href: `/brands/${brandId}/fonts`,
      status: `${fontPairs.length}/5 설정`,
      done: fontPairs.length === 5,
      detail: fontPairs.length === 0 ? "조합을 설정하세요" : `${fontPairs.length}개 역할`,
      group: "boosters",
    },
    {
      title: "Key Visuals",
      description: "실사 공간·인물·제품 사진",
      href: `/brands/${brandId}/key-visuals`,
      status: `${keyVisuals.length}개`,
      done: keyVisuals.length > 0,
      detail:
        keyVisuals.length === 0
          ? "실사 사용 시 업로드 (선택)"
          : `공간 ${kvByKind.space} · 인물 ${kvByKind.person} · 제품 ${kvByKind.product}`,
      group: "optional",
    },
  ];

  const memoryDoneCount = sections.filter((s) => s.done).length;

  const groupMeta: Record<
    SectionGroup,
    { title: string; subtitle: string }
  > = {
    required: {
      title: "Required to launch",
      subtitle: "캠페인 시작 전에 반드시 설정",
    },
    boosters: {
      title: "Creative quality boosters",
      subtitle: "있으면 결과물 품질이 올라가는 항목",
    },
    optional: {
      title: "Optional assets",
      subtitle: "실사 합성을 쓸 때만 필요",
    },
  };
  const groupOrder: SectionGroup[] = ["required", "boosters", "optional"];

  const tabs: PageTabItem[] = [
    {
      id: "memory",
      label: "Brand Memory",
      href: `/brands/${brandId}`,
      count: memoryDoneCount,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      href: `/brands/${brandId}?tab=campaigns`,
      count: campaigns.length,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={brand.name}
        description={brand.website_url ?? undefined}
        actions={
          <>
            <Link href={`/brands/${brandId}/insights`}>
              <Button variant="outline" size="sm">
                Insights
              </Button>
            </Link>
            <BrandInfoEditButton brand={brand} />
            <MoreActionsMenu ariaLabel="브랜드 더보기">
              <DeleteBrandButton
                brandId={brandId}
                brandName={brand.name}
                variant="menu"
              />
            </MoreActionsMenu>
          </>
        }
      >
        {brand.category && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{brand.category}</Badge>
          </div>
        )}
        {brand.description && (
          <p className="text-sm text-muted-foreground pt-2 max-w-2xl">
            {brand.description}
          </p>
        )}
      </PageHeader>

      <PageTabs tabs={tabs} activeId={activeTab} />

      {activeTab === "memory" && (
        <div className="space-y-6">
          {groupOrder.map((g) => {
            const items = sections.filter((s) => s.group === g);
            if (items.length === 0) return null;
            const meta = groupMeta[g];
            const doneInGroup = items.filter((s) => s.done).length;
            return (
              <section key={g} className="space-y-2" aria-labelledby={`group-${g}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2
                      id={`group-${g}`}
                      className="text-sm font-semibold tracking-tight"
                    >
                      {meta.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                  </div>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {doneInGroup}/{items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((s) => (
                    <Link
                      key={s.title}
                      href={s.href}
                      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-full"
                    >
                      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{s.title}</CardTitle>
                            <Badge variant={s.done ? "secondary" : "outline"}>
                              {s.status}
                            </Badge>
                          </div>
                          <CardDescription className="text-xs">
                            {s.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {s.detail}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="space-y-3">
          <div className="flex items-center justify-end gap-2">
            {campaigns.length > 5 && (
              <Link href={`/brands/${brandId}/campaigns`}>
                <Button variant="ghost" size="sm">
                  전체 보기
                </Button>
              </Link>
            )}
            <Link href={`/brands/${brandId}/campaigns/new`}>
              <Button size="sm" disabled={!memoryReady}>
                + 캠페인 시작
              </Button>
            </Link>
          </div>

          {!memoryReady && (
            <Card className="bg-muted/30">
              <CardContent className="py-4 text-sm text-muted-foreground">
                캠페인 시작 전에 Identity · Offer · Audience 최소 1개씩 설정해주세요.
              </CardContent>
            </Card>
          )}

          {memoryReady && campaigns.length === 0 && (
            <EmptyState
              icon="🚀"
              title="아직 캠페인이 없습니다"
              description="Intent 입력으로 Strategy → Copy → Visual 파이프라인을 시작하세요."
              action={
                <Link href={`/brands/${brandId}/campaigns/new`}>
                  <Button size="sm">+ 캠페인 시작</Button>
                </Link>
              }
            />
          )}

          {campaigns.length > 0 && (
            <div className="space-y-2">
              {campaigns.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardContent className="py-3 flex items-center gap-2">
                      <span className="text-sm font-medium flex-1">{c.name}</span>
                      <Badge variant="outline">{c.goal}</Badge>
                      <Badge variant={c.status === "completed" ? "secondary" : "outline"}>
                        {c.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
