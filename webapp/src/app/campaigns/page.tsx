import Link from "next/link";
import { listAllCampaigns } from "@/lib/campaigns";
import { listBrands } from "@/lib/memory";
import { getChannel } from "@/lib/channels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteCampaignButton } from "@/components/campaign/DeleteCampaignButton";
import type { Campaign } from "@/lib/campaigns/types";
import { formatKst } from "@/lib/format/date";
import { FilterChipGroup, type FilterOption } from "@/components/filters/FilterChipGroup";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: "all", label: "전체" },
  { id: "draft", label: "초안" },
  { id: "running", label: "진행 중" },
  { id: "completed", label: "완료" },
  { id: "abandoned", label: "중단" },
];

export default async function CampaignsListPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const currentStatus = status ?? "all";
  const filter = currentStatus !== "all"
    ? { status: currentStatus as Campaign["status"] }
    : undefined;

  const [campaigns, brands] = await Promise.all([
    listAllCampaigns(filter),
    listBrands(),
  ]);
  const brandMap = new Map(brands.map((b) => [b.id, b]));

  const statusChipOptions: FilterOption[] = STATUS_FILTERS.map((f) => ({
    id: f.id,
    label: f.label,
    href: f.id === "all" ? "/campaigns" : `/campaigns?status=${f.id}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground">전체 브랜드의 캠페인 목록</p>
      </div>

      <div>
        <FilterChipGroup
          options={statusChipOptions}
          activeId={currentStatus}
          size="md"
          wrap
        />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {currentStatus === "all"
              ? "아직 생성된 캠페인이 없습니다. 브랜드 페이지에서 새 캠페인을 만들어보세요."
              : `${STATUS_FILTERS.find((f) => f.id === currentStatus)?.label} 상태 캠페인이 없습니다.`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.map((c) => {
            const brand = brandMap.get(c.brand_id);
            const channel = getChannel(c.channel);
            return (
              <div key={c.id} className="relative">
                <Link href={`/campaigns/${c.id}`}>
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    {brand && (
                      <CardDescription className="text-[10px]">
                        {brand.name}
                      </CardDescription>
                    )}
                    <CardTitle className="text-base line-clamp-2 pr-8">
                      {c.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.goal}
                      </Badge>
                      {channel && (
                        <Badge variant="outline" className="text-[10px]">
                          {channel.label}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          c.status === "completed"
                            ? "secondary"
                            : c.status === "abandoned"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {c.status}
                      </Badge>
                      <Badge
                        variant={
                          c.automation_level === "auto"
                            ? "destructive"
                            : c.automation_level === "assist"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {c.automation_level === "auto"
                          ? "🚀"
                          : c.automation_level === "assist"
                            ? "✨"
                            : "🧑‍💻"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {formatKst(c.created_at, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      생성
                    </p>
                  </CardContent>
                </Card>
                </Link>
                <div className="absolute right-3 top-3">
                  <DeleteCampaignButton
                    campaignId={c.id}
                    campaignName={c.name}
                    variant="icon"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
