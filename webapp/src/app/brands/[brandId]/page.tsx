import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBrandMemory } from "@/lib/memory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteBrandButton } from "@/components/brand/DeleteBrandButton";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const memory = await loadBrandMemory(brandId);
  if (!memory) notFound();

  const { brand, identity, offers, audiences, references, fontPairs } = memory;
  const readyRefs = references.filter((r) => r.vision_status === "ready").length;
  const pendingRefs = references.filter((r) => r.vision_status === "pending").length;
  const failedRefs = references.filter((r) => r.vision_status === "failed").length;

  const sections = [
    {
      title: "Identity",
      description: "보이스·금지어·컬러·로고",
      href: `/brands/${brandId}/identity`,
      status: identity ? "설정 완료" : "미설정",
      done: Boolean(identity),
      detail: identity
        ? `${identity.colors_json.length} 컬러 · ${identity.taboos.length} 금지어`
        : "보이스·컬러를 설정하세요",
    },
    {
      title: "Offers",
      description: "USP·가격·혜택·긴급성",
      href: `/brands/${brandId}/offers`,
      status: `${offers.length}개`,
      done: offers.length > 0,
      detail: offers[0]?.title ?? "오퍼를 등록하세요",
    },
    {
      title: "Audiences",
      description: "타겟 페르소나",
      href: `/brands/${brandId}/audiences`,
      status: `${audiences.length}개`,
      done: audiences.length > 0,
      detail: audiences[0]?.persona_name ?? "페르소나를 정의하세요",
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
    },
    {
      title: "Fonts",
      description: "역할별 폰트 조합",
      href: `/brands/${brandId}/fonts`,
      status: `${fontPairs.length}/5 설정`,
      done: fontPairs.length === 5,
      detail: fontPairs.length === 0 ? "조합을 설정하세요" : `${fontPairs.length}개 역할`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
          {brand.website_url && (
            <p className="text-muted-foreground text-sm">{brand.website_url}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {brand.category && <Badge variant="outline">{brand.category}</Badge>}
          </div>
          {brand.description && (
            <p className="text-sm text-muted-foreground pt-2 max-w-2xl">{brand.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <DeleteBrandButton brandId={brandId} brandName={brand.name} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Brand Memory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link key={s.title} href={s.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <Badge variant={s.done ? "secondary" : "outline"}>{s.status}</Badge>
                  </div>
                  <CardDescription className="text-xs">{s.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.detail}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">다음 단계</CardTitle>
          <CardDescription>
            M2에서 캠페인 Intent → Strategy → Copy → Visual 파이프라인이 추가됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            + 캠페인 시작 (M2에서 활성화)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
