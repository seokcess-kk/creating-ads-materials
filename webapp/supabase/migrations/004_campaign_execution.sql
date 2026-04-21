-- M2: Campaign Execution

CREATE TYPE campaign_goal AS ENUM ('TOFU', 'MOFU', 'BOFU');
CREATE TYPE campaign_status AS ENUM ('draft', 'running', 'completed', 'abandoned');
CREATE TYPE creative_stage AS ENUM ('strategy', 'copy', 'visual', 'retouch', 'compose', 'ship');
CREATE TYPE run_status AS ENUM (
  'pending', 'strategy', 'copy', 'visual',
  'retouch', 'compose', 'ship', 'complete', 'failed'
);
CREATE TYPE stage_status AS ENUM ('pending', 'running', 'ready', 'failed');

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal campaign_goal DEFAULT 'BOFU',
  offer_id UUID REFERENCES brand_offers(id) ON DELETE SET NULL,
  audience_id UUID REFERENCES brand_audiences(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  constraints_json JSONB DEFAULT '{}'::jsonb,
  status campaign_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_brand ON campaigns(brand_id);
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE creative_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  status run_status DEFAULT 'pending',
  current_stage creative_stage,
  brand_memory_snapshot JSONB DEFAULT '{}'::jsonb,
  playbook_version TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creative_runs_campaign ON creative_runs(campaign_id);
CREATE TRIGGER creative_runs_updated_at
  BEFORE UPDATE ON creative_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE creative_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES creative_runs(id) ON DELETE CASCADE,
  stage creative_stage NOT NULL,
  status stage_status DEFAULT 'pending',
  input_json JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (run_id, stage)
);

CREATE INDEX idx_creative_stages_run ON creative_stages(run_id);

CREATE TABLE creative_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES creative_stages(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content_json JSONB DEFAULT '{}'::jsonb,
  scores_json JSONB DEFAULT '{}'::jsonb,
  prompt_version TEXT,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creative_variants_stage ON creative_variants(stage_id);
