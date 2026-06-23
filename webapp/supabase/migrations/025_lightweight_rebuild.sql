-- M25: 경량 재설계 — 단일 이미지 + 캐러셀(2단 기획)을 독립 엔티티로 도입 (additive)
--   - 무거운 campaign/run/stage/variant 파이프라인 및 cardnews(campaign 종속)와 분리.
--   - 두 엔티티 모두 owner_id 직접 스코프 → 브랜드 없이도 생성 가능(브랜드는 선택적 컨텍스트).
--   - 구 테이블 DROP은 별도 정리 마이그레이션(026)에서 수행(클린 삭제).
--   - 의존: update_updated_at() (001), gen_random_uuid(), brands(owner_id) (020/021).

BEGIN;

-- ── 단일 이미지 ────────────────────────────────────────────────
-- 한 번의 생성 요청(input) → N장 후보(image_variants).
CREATE TABLE IF NOT EXISTS image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,        -- 선택적 컨텍스트
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,                 -- concept/headline/sub/cta/aspectRatio/tone/mode
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','ready','failed')),
  error TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS image_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES image_generations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  label TEXT,
  selected BOOLEAN NOT NULL DEFAULT false,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- mode/track/prompt
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_image_generations_owner ON image_generations(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_variants_generation ON image_variants(generation_id);

-- ── 캐러셀(2단 기획) ──────────────────────────────────────────
-- 번들 콘셉트(concept_json) → 슬라이드 상세(carousel_slides). 카피/디렉션을 행으로 보존해
-- "카피 편집 → 재합성(LLM 0회)"을 가능케 한다.
CREATE TABLE IF NOT EXISTS carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,        -- 선택적 컨텍스트
  title TEXT NOT NULL DEFAULT '',
  raw_content TEXT NOT NULL DEFAULT '',
  tone_override TEXT,
  content_mode TEXT NOT NULL DEFAULT 'persuasion' CHECK (content_mode IN ('persuasion','notice')),
  bg_mode TEXT NOT NULL DEFAULT 'shared' CHECK (bg_mode IN ('shared','per-slide')),
  bg_url TEXT,                                                   -- shared 모드 공통 배경
  concept_json JSONB NOT NULL DEFAULT '{}'::jsonb,              -- BundleConcept
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','concept','generating','ready','failed')),
  error TEXT,
  prompt_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carousel_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carousel_id UUID NOT NULL REFERENCES carousels(id) ON DELETE CASCADE,
  idx INT NOT NULL,                                              -- 1-based
  role TEXT NOT NULL CHECK (role IN ('hook','point','cta')),
  kicker TEXT,
  headline TEXT NOT NULL DEFAULT '',
  body TEXT,
  visual_json JSONB NOT NULL DEFAULT '{}'::jsonb,              -- {motif, emphasis}
  bg_url TEXT,                                                   -- per-slide 모드 배경(shared면 NULL)
  image_url TEXT,                                               -- 합성 결과
  image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (carousel_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_carousels_owner ON carousels(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_carousel_slides_carousel ON carousel_slides(carousel_id, idx);

CREATE TRIGGER carousels_updated_at
  BEFORE UPDATE ON carousels FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER carousel_slides_updated_at
  BEFORE UPDATE ON carousel_slides FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE image_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "image_generations_owner" ON image_generations
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE image_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "image_variants_via_gen_owner" ON image_variants
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.image_generations g
    WHERE g.id = image_variants.generation_id AND g.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.image_generations g
    WHERE g.id = image_variants.generation_id AND g.owner_id = auth.uid()));

ALTER TABLE carousels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carousels_owner" ON carousels
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carousel_slides_via_carousel_owner" ON carousel_slides
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.carousels c
    WHERE c.id = carousel_slides.carousel_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.carousels c
    WHERE c.id = carousel_slides.carousel_id AND c.owner_id = auth.uid()));

COMMIT;
