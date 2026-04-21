-- M-UX1: Batch 기반 재생성 모델
-- Replace(기본)/Add/Remix 3가지 모드. 이전 배치는 archived_at으로 soft-archive.

ALTER TABLE creative_variants
  ADD COLUMN batch_id UUID,
  ADD COLUMN batch_index INTEGER,
  ADD COLUMN batch_mode TEXT,
  ADD COLUMN batch_instruction TEXT,
  ADD COLUMN base_variant_id UUID REFERENCES creative_variants(id) ON DELETE SET NULL,
  ADD COLUMN archived_at TIMESTAMPTZ;

-- 기존 데이터: 각 stage의 모든 variant를 하나의 legacy 배치로 묶음
WITH stage_batches AS (
  SELECT stage_id, gen_random_uuid() AS batch_id
  FROM (SELECT DISTINCT stage_id FROM creative_variants) s
)
UPDATE creative_variants v
SET
  batch_id = sb.batch_id,
  batch_index = 1,
  batch_mode = 'legacy',
  batch_instruction = NULL
FROM stage_batches sb
WHERE v.stage_id = sb.stage_id
  AND v.batch_id IS NULL;

-- 이후 삽입되는 row는 반드시 값이 채워짐
ALTER TABLE creative_variants
  ALTER COLUMN batch_id SET NOT NULL,
  ALTER COLUMN batch_index SET NOT NULL,
  ALTER COLUMN batch_mode SET NOT NULL;

ALTER TABLE creative_variants
  ADD CONSTRAINT batch_mode_valid
  CHECK (batch_mode IN ('replace', 'add', 'remix', 'legacy'));

CREATE INDEX idx_creative_variants_batch ON creative_variants(stage_id, batch_id);
CREATE INDEX idx_creative_variants_active ON creative_variants(stage_id) WHERE archived_at IS NULL;
