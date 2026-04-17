-- 브랜드 에셋 재설계: 유형별 분리 + 컬러 테이블

-- 에셋 카테고리 세분화
ALTER TABLE brand_assets DROP COLUMN IF EXISTS asset_type;
ALTER TABLE brand_assets ADD COLUMN asset_category TEXT DEFAULT 'other';
-- 값: logo | key_visual | credential | pattern | icon | reference

ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;
-- logo: { "variant": "full|icon", "theme": "light|dark" }
-- key_visual: { "visual_type": "product|space|person|screenshot", "name": "..." }
-- credential: { "type": "certification|award|review" }

ALTER TABLE brand_assets ADD COLUMN IF NOT EXISTS usage_rule TEXT;
-- "소재 좌상단, 너비 15%"

-- 에셋 타입 enum 삭제 (더 이상 사용하지 않음)
DROP TYPE IF EXISTS asset_type;

-- 브랜드 컬러 테이블
CREATE TABLE IF NOT EXISTS brand_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  hex TEXT NOT NULL,
  usage TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_colors_brand_id ON brand_colors(brand_id);

-- campaigns 테이블에 컬러 오버라이드 컬럼 추가
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS color_override_json JSONB DEFAULT '{}'::jsonb;
