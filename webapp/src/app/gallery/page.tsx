import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { DownloadButton } from "@/components/common/DownloadButton";
import { DownloadThumb } from "@/components/common/DownloadThumb";
import { listGenerations, type GenerationSummary } from "@/lib/generate/queries";
import { listCarousels } from "@/lib/carousel/queries";
import type { CarouselRow } from "@/lib/carousel/types";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  let generations: GenerationSummary[] = [];
  let carousels: CarouselRow[] = [];
  try {
    generations = await listGenerations(20);
  } catch {
    generations = [];
  }
  try {
    carousels = await listCarousels(20);
  } catch {
    carousels = [];
  }

  const empty = generations.length === 0 && carousels.length === 0;

  return (
    <PageContainer>
      <PageHeader title="갤러리" description="최근 생성한 단일 이미지와 캐러셀" />

      {empty && (
        <EmptyState
          title="아직 생성한 결과가 없습니다"
          description="단일 이미지나 캐러셀을 만들면 여기에 모입니다."
          action={
            <div className="flex gap-2">
              <Link href="/generate">
                <Button size="sm">단일 이미지</Button>
              </Link>
              <Link href="/carousel">
                <Button size="sm" variant="outline">
                  캐러셀
                </Button>
              </Link>
            </div>
          }
        />
      )}

      {generations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">단일 이미지</h2>
          {generations.map((g) => (
            <div key={g.generation.id} className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                {g.variants.map((v) => (
                  <DownloadThumb
                    key={v.id}
                    url={v.url}
                    filename={`ad_${v.label ?? v.id}.png`}
                    alt={v.label ?? "이미지"}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {carousels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">캐러셀</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {carousels.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      {c.title || "캐러셀"}
                    </CardTitle>
                    <Badge
                      variant={c.status === "ready" ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {c.status === "ready" ? (
                    <DownloadButton
                      url={`/api/carousels/${c.id}/download`}
                      filename={`carousel_${c.id}.zip`}
                      className="text-xs text-primary hover:underline"
                      successToast="zip 저장됨"
                    >
                      zip 다운로드
                    </DownloadButton>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      미완성
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
