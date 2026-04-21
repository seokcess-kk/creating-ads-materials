-- Phase 1: 실사 기반 광고 소재 — 브랜드 Key Visual 저장소
-- 공간/인물/제품 실사를 브랜드 자산으로 관리하고,
-- 캠페인에서 selected_key_visual_ids로 참조하여 Visual 생성 시 분기 적용.

-- Key Visual 테이블
CREATE TABLE brand_key_visuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'space', 'product')),
  label TEXT NOT NULL,
  description TEXT,
  focal_area JSONB,
  mood_tags TEXT[] DEFAULT '{}',
  is_primary BOOLEAN DEFAULT false,
  vision_status vision_status DEFAULT 'pending',
  vision_analyzed_at TIMESTAMPTZ,
  vision_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_key_visuals_brand ON brand_key_visuals(brand_id);
CREATE INDEX idx_brand_key_visuals_kind ON brand_key_visuals(brand_id, kind);

CREATE TRIGGER brand_key_visuals_updated_at
  BEFORE UPDATE ON brand_key_visuals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 브랜드가 실사 기반인지 플래그
ALTER TABLE brands
  ADD COLUMN uses_real_assets BOOLEAN DEFAULT false;

-- 캠페인에 Key Visual 선택 정보
-- key_visual_intent: 사용자 자연어 의도 ("원장님 전문성 어필")
-- selected_key_visual_ids: variant별로 쓸 실사 자산 ID 배열
ALTER TABLE campaigns
  ADD COLUMN key_visual_intent TEXT,
  ADD COLUMN selected_key_visual_ids UUID[] DEFAULT '{}';

-- NOTE: Storage 버킷 `brand-key-visuals`는 Supabase 대시보드에서 수동 생성 필요.
--   - 위치: Storage → New bucket
--   - 이름: brand-key-visuals
--   - Public bucket: ✓ (public read)
-- 이 프로젝트는 마이그레이션 SQL로 버킷을 만들지 않는다 (관리형 환경 권한 제약).
-- DEPLOY.md "필수 사전 조건" 섹션 참고.
