-- API 사용량 추적

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  input_tokens INT,
  output_tokens INT,
  cache_read_tokens INT,
  image_count INT,
  estimated_cost_usd NUMERIC(12, 6),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_brand ON api_usage(brand_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_campaign ON api_usage(campaign_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_operation ON api_usage(operation);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at DESC);
