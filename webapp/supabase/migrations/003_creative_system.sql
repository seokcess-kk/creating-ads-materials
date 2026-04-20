 -- Creative System: Brand Memory + Fonts + Versioning
-- 기존 스키마 전면 교체

-- 1. 기존 객체 제거
DROP TABLE IF EXISTS creatives CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS best_practices CASCADE;
DROP TABLE IF EXISTS brand_assets CASCADE;
DROP TABLE IF EXISTS brand_colors CASCADE;
DROP TABLE IF EXISTS fonts CASCADE;
DROP TABLE IF EXISTS brands CASCADE;

DROP TYPE IF EXISTS campaign_status CASCADE;
DROP TYPE IF EXISTS creative_status CASCADE;
DROP TYPE IF EXISTS font_category CASCADE;
DROP TYPE IF EXISTS asset_type CASCADE;

-- 2. 공통 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Enum
CREATE TYPE font_tier AS ENUM ('tier0', 'tier1', 'tier2', 'tier3');
CREATE TYPE reference_source AS ENUM ('bp_upload', 'own_archive', 'competitor', 'industry');
CREATE TYPE vision_status AS ENUM ('pending', 'ready', 'failed');

-- 4. Brand Memory

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  website_url TEXT,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE brand_identity (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  voice_json JSONB DEFAULT '{}'::jsonb,
  taboos TEXT[] DEFAULT '{}',
  colors_json JSONB DEFAULT '[]'::jsonb,
  logo_urls_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER brand_identity_updated_at
  BEFORE UPDATE ON brand_identity FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE brand_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  usp TEXT,
  price TEXT,
  benefits TEXT[] DEFAULT '{}',
  urgency TEXT,
  evidence TEXT[] DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_offers_brand ON brand_offers(brand_id);
CREATE TRIGGER brand_offers_updated_at
  BEFORE UPDATE ON brand_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE brand_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,
  demographics JSONB DEFAULT '{}'::jsonb,
  language_level TEXT,
  pains TEXT[] DEFAULT '{}',
  desires TEXT[] DEFAULT '{}',
  notes TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_audiences_brand ON brand_audiences(brand_id);
CREATE TRIGGER brand_audiences_updated_at
  BEFORE UPDATE ON brand_audiences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE brand_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  source_type reference_source DEFAULT 'bp_upload',
  source_note TEXT,
  is_negative BOOLEAN DEFAULT false,
  weight INT DEFAULT 50 CHECK (weight BETWEEN 0 AND 100),
  vision_analysis_json JSONB DEFAULT '{}'::jsonb,
  vision_prompt_version TEXT,
  vision_status vision_status DEFAULT 'pending',
  vision_error TEXT,
  vision_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_brand_references_brand ON brand_references(brand_id);
CREATE INDEX idx_brand_references_status ON brand_references(vision_status);
CREATE TRIGGER brand_references_updated_at
  BEFORE UPDATE ON brand_references FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE brand_learnings (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  hook_win_rates_json JSONB DEFAULT '{}'::jsonb,
  framework_win_rates_json JSONB DEFAULT '{}'::jsonb,
  visual_patterns_json JSONB DEFAULT '{}'::jsonb,
  anti_patterns_json JSONB DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Fonts

CREATE TABLE fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL,
  weight TEXT,
  style TEXT DEFAULT 'normal',
  file_path TEXT NOT NULL,
  file_format TEXT,
  tier font_tier NOT NULL,
  category TEXT,
  tone_tags TEXT[] DEFAULT '{}',
  language_support TEXT[] DEFAULT '{}',
  recommended_roles TEXT[] DEFAULT '{}',
  license_confirmed BOOLEAN DEFAULT true,
  license_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (family, weight, style, tier)
);

CREATE INDEX idx_fonts_tier ON fonts(tier);
CREATE INDEX idx_fonts_category ON fonts(category);
CREATE INDEX idx_fonts_tone_tags ON fonts USING gin(tone_tags);

CREATE TABLE brand_font_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  font_id UUID NOT NULL REFERENCES fonts(id) ON DELETE RESTRICT,
  hierarchy_ratio NUMERIC(4,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand_id, role)
);

CREATE INDEX idx_brand_font_pairs_brand ON brand_font_pairs(brand_id);

-- 6. Versioning (M2 이후 활용)

CREATE TABLE playbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  rules_json JSONB NOT NULL,
  changelog TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform, version)
);

CREATE TABLE prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  template TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name, version)
);
