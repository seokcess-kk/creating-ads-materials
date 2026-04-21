-- P2: 캠페인별 폰트 오버라이드 지원
-- brand_font_pairs에 campaign_id 컬럼 추가 — NULL이면 브랜드 기본, 값 있으면 해당 캠페인 전용

ALTER TABLE brand_font_pairs
  ADD COLUMN campaign_id UUID NULL REFERENCES campaigns(id) ON DELETE CASCADE;

-- 기존 UNIQUE (brand_id, role)은 NULL 허용 컬럼과 호환되지 않음.
-- partial unique index 두 개로 분리:
--   - 브랜드 기본:   (brand_id, role) UNIQUE where campaign_id IS NULL
--   - 캠페인 오버라이드: (brand_id, campaign_id, role) UNIQUE where campaign_id IS NOT NULL

ALTER TABLE brand_font_pairs
  DROP CONSTRAINT brand_font_pairs_brand_id_role_key;

CREATE UNIQUE INDEX brand_font_pairs_brand_role_default_uq
  ON brand_font_pairs(brand_id, role)
  WHERE campaign_id IS NULL;

CREATE UNIQUE INDEX brand_font_pairs_campaign_role_override_uq
  ON brand_font_pairs(brand_id, campaign_id, role)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX idx_brand_font_pairs_campaign
  ON brand_font_pairs(campaign_id)
  WHERE campaign_id IS NOT NULL;
