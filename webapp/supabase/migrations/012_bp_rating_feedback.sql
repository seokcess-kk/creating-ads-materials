-- Phase 2: Ship 평점 → BP weight 자동 재가중
-- 런 단위로 어떤 BP에 얼마의 delta를 적용했는지 기록해, 평점이 변경/취소되면 이전 적용을 정확히 되돌릴 수 있게 한다.

CREATE TABLE bp_rating_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES creative_runs(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES brand_references(id) ON DELETE CASCADE,
  applied_rating INTEGER NOT NULL CHECK (applied_rating BETWEEN 1 AND 5),
  delta INTEGER NOT NULL,
  match_score NUMERIC(4, 3) NOT NULL,
  signals_json JSONB,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 한 run에 대해 각 BP는 최대 1건만 active feedback을 갖는다. (평점 변경 시 delete → re-insert)
CREATE UNIQUE INDEX idx_bp_feedback_run_ref ON bp_rating_feedback(run_id, reference_id);
CREATE INDEX idx_bp_feedback_run ON bp_rating_feedback(run_id);
CREATE INDEX idx_bp_feedback_ref ON bp_rating_feedback(reference_id);
