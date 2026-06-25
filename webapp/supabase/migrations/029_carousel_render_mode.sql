-- M29: 캐러셀 렌더 모드 — full(모델이 텍스트까지 구운 완성형 슬라이드) vs overlay(텍스트 없는 배경 + 컴포지터 한글 오버레이) (additive, idempotent).
--   - full: gpt-image-2가 디자인+한글 텍스트를 한 번에 렌더 → "배경+떠있는 자막" 분리 해소(품질↑). 카피 수정 시 해당 슬라이드 재생성.
--   - overlay: 기존 동작(한글 100% 안정 + LLM 없이 즉시 재합성).
--   - 기존 행은 overlay로 만들어졌으므로 기본값 'overlay'로 보존. 신규 캐러셀은 생성 라우트가 'full'을 명시.
--   - 의존: 025(carousels). ADD COLUMN IF NOT EXISTS라 재실행 안전.

BEGIN;

ALTER TABLE carousels
  ADD COLUMN IF NOT EXISTS render_mode TEXT NOT NULL DEFAULT 'overlay'
  CHECK (render_mode IN ('full', 'overlay'));

COMMIT;
