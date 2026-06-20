-- M24: 카드뉴스(캐러셀) format + 저장
-- 단일 광고 이미지(single)와 별개로, 원문 한 덩어리 → N장 카드뉴스(carousel)를 만든다.
-- v1: 캠페인당 카드뉴스 1개(UNIQUE), 재생성 시 upsert로 교체.

ALTER TABLE campaigns
  ADD COLUMN format TEXT NOT NULL DEFAULT 'single'
    CHECK (format IN ('single', 'carousel'));

COMMENT ON COLUMN campaigns.format IS 'single=단일 이미지 / carousel=카드뉴스(N슬라이드)';

CREATE TABLE cardnews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  bg_url TEXT,
  -- [{ index, role, kicker?, headline, body?, url }]
  slides_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'ready',
  prompt_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id)
);

CREATE INDEX idx_cardnews_campaign ON cardnews(campaign_id);
CREATE TRIGGER cardnews_updated_at
  BEFORE UPDATE ON cardnews FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: campaigns → brands owner 조인 (021 패턴)
ALTER TABLE cardnews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cardnews_via_campaign_owner" ON cardnews
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.brands b ON b.id = c.brand_id
    WHERE c.id = cardnews.campaign_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.brands b ON b.id = c.brand_id
    WHERE c.id = cardnews.campaign_id AND b.owner_id = auth.uid()
  ));
