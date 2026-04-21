-- M-UX3: Auto-pilot 모드 (Assist / Auto)

CREATE TYPE automation_level AS ENUM ('manual', 'assist', 'auto');

ALTER TABLE campaigns
  ADD COLUMN automation_level automation_level NOT NULL DEFAULT 'assist';

-- assist: 각 단계 생성 후 최고 평점 variant 자동 pre-select. 사용자가 변경 가능.
-- auto:   assist + 선택 후 다음 단계 자동 진행(서버 측 chain). Compose 단계에서 정지.
-- manual: 기존 동작 (수동 선택 필수).
