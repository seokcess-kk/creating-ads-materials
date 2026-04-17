-- 광고 소재 제작 웹 앱 초기 스키마

-- 캠페인 상태 enum
CREATE TYPE campaign_status AS ENUM (
  'draft', 'in_progress', 'completed'
);

-- 소재 상태 enum
CREATE TYPE creative_status AS ENUM (
  'pending', 'brief_done', 'copy_done', 'images_done',
  'review1_done', 'composed', 'review2_done',
  'approved', 'rejected'
);

-- 브랜드 에셋 타입 enum
CREATE TYPE asset_type AS ENUM (
  'logo', 'color', 'existing_creative', 'screenshot', 'other'
);

-- 폰트 카테고리 enum
CREATE TYPE font_category AS ENUM (
  'premium_sans', 'impact_display', 'serif',
  'rounded_sans', 'handwriting', 'brand_exclusive', 'decorative'
);

-- 1. 브랜드
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website_url TEXT,
  style_guide_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 브랜드 에셋
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  asset_type asset_type DEFAULT 'other',
  analysis_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BP 레퍼런스
CREATE TABLE best_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  source TEXT,
  analysis_json JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 폰트
CREATE TABLE fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT NOT NULL,
  weight TEXT,
  category font_category,
  style_tags TEXT[] DEFAULT '{}',
  tone_tags TEXT[] DEFAULT '{}',
  recommended_for JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 캠페인
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_channels TEXT[] DEFAULT '{}',
  brief_json JSONB DEFAULT '{}'::jsonb,
  copy_json JSONB DEFAULT '{}'::jsonb,
  font_config_json JSONB DEFAULT '{}'::jsonb,
  ref_bp_ids UUID[] DEFAULT '{}',
  status campaign_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 소재
CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  file_url TEXT,
  bg_image_url TEXT,
  channel TEXT,
  aspect_ratio TEXT,
  copy_json JSONB DEFAULT '{}'::jsonb,
  font_config_json JSONB DEFAULT '{}'::jsonb,
  review1_json JSONB DEFAULT '{}'::jsonb,
  review2_json JSONB DEFAULT '{}'::jsonb,
  score NUMERIC(3,1),
  status creative_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_brand_assets_brand_id ON brand_assets(brand_id);
CREATE INDEX idx_best_practices_brand_id ON best_practices(brand_id);
CREATE INDEX idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX idx_fonts_category ON fonts(category);
CREATE INDEX idx_fonts_family ON fonts(family);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER creatives_updated_at
  BEFORE UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
