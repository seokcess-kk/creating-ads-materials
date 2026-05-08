-- 022: Material Runs
-- creative_runs를 "캠페인 실행 1회"에서 "캠페인 안의 소재 작업물 1개"로 승격.
-- 다중 run 지원을 위한 메타 컬럼 + 비용 추적 분리.
-- 코드 변경 없음 (백워드 호환): 기존 getLatestRun(campaignId)는 그대로 동작.

BEGIN;

-- 1) creative_runs: 소재 메타 컬럼 추가
ALTER TABLE creative_runs
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS parent_run_id UUID
    REFERENCES creative_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS iteration_index INTEGER,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2) 기존 run 백필: 캠페인별 started_at 오름차순으로 번호 매김
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id
      ORDER BY started_at ASC, id ASC
    ) AS idx
  FROM creative_runs
)
UPDATE creative_runs r
SET
  iteration_index = COALESCE(r.iteration_index, n.idx),
  label = COALESCE(r.label, '소재 ' || n.idx::text)
FROM numbered n
WHERE r.id = n.id
  AND (r.iteration_index IS NULL OR r.label IS NULL);

-- 3) 인덱스: 활성 run 조회·자식 run 조회 가속
CREATE INDEX IF NOT EXISTS idx_creative_runs_campaign_active
  ON creative_runs(campaign_id, started_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_creative_runs_parent
  ON creative_runs(parent_run_id)
  WHERE parent_run_id IS NOT NULL;

-- 4) api_usage: 소재(run) 단위 비용 추적
ALTER TABLE api_usage
  ADD COLUMN IF NOT EXISTS run_id UUID
    REFERENCES creative_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_usage_run ON api_usage(run_id);

COMMIT;
