-- M30: 캐러셀 구조화 스타일 노브 — 조명/팔레트/무드(선택). UI 프리셋 칩에서 gpt-image 영어 구문으로 저장.
--   생성 시 아트디렉터 styleLock/배경 프롬프트에 주입(가이드 8슬롯 ④팔레트·⑤조명·⑥무드).
--   콘셉트→슬라이드 2단계라 carousels 행에 영속해야 slides 라우트가 읽을 수 있다.
--   nullable(미선택 시 아트디렉터 자율). 의존: 025(carousels). ADD COLUMN IF NOT EXISTS라 재실행 안전.

BEGIN;

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS style_lighting TEXT,
  ADD COLUMN IF NOT EXISTS style_palette TEXT,
  ADD COLUMN IF NOT EXISTS style_mood TEXT;

COMMIT;
