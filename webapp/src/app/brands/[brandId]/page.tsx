import Link from "next/link";
import { getBrand } from "@/lib/db/brands";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetUploader } from "@/components/brand/AssetUploader";
import { StyleGuideView } from "@/components/brand/StyleGuideView";
import { DeleteBrandButton } from "@/components/brand/DeleteBrandButton";
import { KeyVisualManager } from "@/components/brand/KeyVisualManager";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);

  const hasStyleGuide = Object.keys(brand.style_guide_json || {}).length > 0;
  const styleGuide = brand.style_guide_json as Record<string, unknown>;
  const keyVisualType = styleGuide?.visual_style
    ? (styleGuide.visual_style as Record<string, string>)?.key_visual_type
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{brand.name}</h1>
          {brand.website_url && (
            <p className="text-muted-foreground text-sm">{brand.website_url}</p>
          )}
        </div>
        <div className="flex gap-2">
          <DeleteBrandButton brandId={brandId} brandName={brand.name} />
          <Link href={`/brands/${brandId}/best-practices`}>
            <Button variant="outline">BP 레퍼런스</Button>
          </Link>
          <Link href={`/brands/${brandId}/campaigns/new`}>
            <Button>+ 캠페인 시작</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 로고/에셋 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              브랜드 에셋
              {hasStyleGuide && <Badge variant="secondary">분석 완료</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssetUploader brandId={brandId} />
          </CardContent>
        </Card>

        {/* 스타일 가이드 */}
        <Card>
          <CardHeader>
            <CardTitle>스타일 가이드</CardTitle>
          </CardHeader>
          <CardContent>
            {hasStyleGuide ? (
              <StyleGuideView styleGuide={brand.style_guide_json} />
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p>에셋을 업로드하고 &quot;분석 시작&quot; 버튼을 누르면</p>
                <p>Claude가 자동으로 스타일 가이드를 생성합니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 직접 사용 이미지 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              직접 사용 이미지
              {keyVisualType && (
                <Badge variant="outline" className="text-xs font-normal">
                  BP 추천: {keyVisualType === "space" ? "공간 사진" : keyVisualType === "product" ? "제품 사진" : keyVisualType === "person" ? "인물 사진" : keyVisualType}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KeyVisualManager brandId={brandId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
