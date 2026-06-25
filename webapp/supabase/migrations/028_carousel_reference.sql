-- M28: 캐러셀 레퍼런스 첨부 — 입력 레퍼런스 이미지 1장 + 추출된 디자인 요소 저장 (additive, idempotent).
--   - reference_url: 업로드된 레퍼런스 공개 URL(generated-images/refs/...). 단일 이미지와 동일 버킷/서명 경로 재사용.
--   - reference_json: analyzeReferenceDesign 산출 DesignReference(palette/mood/composition/layout/typographyVibe).
--     아트디렉터가 styleLock 기반으로 사용해 전 슬라이드 배경을 레퍼런스 룩으로 통일.
--   - 의존: 025(carousels). ADD COLUMN IF NOT EXISTS라 재실행 안전.

BEGIN;

ALTER TABLE carousels ADD COLUMN IF NOT EXISTS reference_url TEXT;
ALTER TABLE carousels ADD COLUMN IF NOT EXISTS reference_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
