-- M-UX2: Stage Invalidation
-- 상위 stage 변경 시 하위 stage를 'stale'로 마킹하여 사용자에게 재생성 필요성 알림

ALTER TYPE stage_status ADD VALUE IF NOT EXISTS 'stale';

-- 진행 중 경과 시간 표시용 — started_at은 이미 존재. 추가 필드 불필요.
-- 단, running 중인 stage를 pending으로 구분하지 않으면 timer 시작이 모호.
-- 현재 로직: upsertStage가 running으로 강제 세팅 → started_at 업데이트됨. OK.
