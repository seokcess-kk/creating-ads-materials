import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrand, getIdentity } from "@/lib/memory";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteBrandButton } from "@/components/brand/DeleteBrandButton";
import { BrandInfoEditButton } from "@/components/brand/BrandInfoEditButton";
import { MoreActionsMenu } from "@/components/common/MoreActionsMenu";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  const identity = await getIdentity(brandId).catch(() => null);
  const colors = identity?.colors_json ?? [];
  const logos = identity?.logos_json ?? [];

  return (
    <PageContainer size="narrow">
      <PageHeader
        title={brand.name}
        description={brand.website_url ?? undefined}
        actions={
          <>
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
          <p className="max-w-2xl pt-2 text-sm text-muted-foreground">
            {brand.description}
          </p>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/generate" className="block rounded-lg">
          <Card className="h-full transition-colors hover:border-foreground/30 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">단일 이미지 만들기</CardTitle>
              <CardDescription>이 브랜드 카테고리·로고를 반영해 생성</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/carousel" className="block rounded-lg">
          <Card className="h-full transition-colors hover:border-foreground/30 cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">캐러셀 만들기</CardTitle>
              <CardDescription>번들 기획 → 슬라이드별 상세</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {(colors.length > 0 || logos.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">브랜드 에셋</CardTitle>
            <CardDescription className="text-xs">
              생성 시 선택적으로 반영됩니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {colors.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {colors.map((c, i) => (
                  <span
                    key={`${c.hex}-${i}`}
                    className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-sm border"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.role}
                  </span>
                ))}
              </div>
            )}
            {logos.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {logos.map((l) => (
                  <img
                    key={l.id}
                    src={l.url}
                    alt={l.label ?? "logo"}
                    className="h-10 w-auto rounded border bg-muted object-contain px-2"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <Link href="/brands" className="text-sm text-muted-foreground underline">
          ← 브랜드 목록
        </Link>
      </div>
    </PageContainer>
  );
}
