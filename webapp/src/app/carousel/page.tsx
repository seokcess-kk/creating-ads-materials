import { listBrands } from "@/lib/memory";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  CarouselStudio,
  type InitialCarousel,
  type RecentCarousel,
} from "@/components/carousel/CarouselStudio";
import { getCarousel, listCarousels } from "@/lib/carousel/queries";
import { BundleConceptSchema } from "@/lib/carousel/prompts";

export const dynamic = "force-dynamic";

export default async function CarouselPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const [brands, recentRows] = await Promise.all([listBrands(), listCarousels()]);

  let initial: InitialCarousel | null = null;
  if (id) {
    const data = await getCarousel(id);
    if (data) {
      const c = data.carousel;
      const parsed = BundleConceptSchema.safeParse(c.concept_json);
      initial = {
        id: c.id,
        status: c.status,
        rawContent: c.raw_content,
        toneOverride: c.tone_override,
        brandId: c.brand_id,
        contentMode: c.content_mode,
        bgMode: c.bg_mode,
        renderMode: c.render_mode,
        referenceUrl: c.reference_url,
        concept: parsed.success ? parsed.data : null,
        slides: data.slides.map((s) => ({
          id: s.id,
          idx: s.idx,
          role: s.role,
          kicker: s.kicker,
          headline: s.headline,
          body: s.body,
          image_url: s.image_url,
        })),
      };
    }
  }

  const recent: RecentCarousel[] = recentRows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <PageContainer size="narrow">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">캐러셀 만들기</h1>
        <p className="text-muted-foreground">
          원문 → 번들 기획(콘셉트·서사) → 슬라이드별 상세 → 합성. 단계마다 검토·편집할 수 있습니다.
        </p>
      </div>
      <CarouselStudio
        key={id ?? "new"}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        recent={recent}
        initial={initial}
      />
    </PageContainer>
  );
}
