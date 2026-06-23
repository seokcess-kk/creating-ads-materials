-- M26: 구 파이프라인/무거운 메모리 테이블 정리 (DROP) — 선택 적용
--   경량 재설계 후 더 이상 코드에서 참조하지 않는 테이블을 제거한다.
--   ⚠️ 파괴적: 운영 데이터가 없을 때만 적용(클린 전제). 025(additive)와 달리 필수 아님.
--   KEEP: brands, brand_identity, api_usage, image_generations/variants(025), carousels/carousel_slides(025).

BEGIN;

-- 캠페인 다단계 파이프라인
DROP TABLE IF EXISTS creative_variants CASCADE;
DROP TABLE IF EXISTS creative_stages CASCADE;
DROP TABLE IF EXISTS creative_runs CASCADE;
DROP TABLE IF EXISTS cardnews CASCADE;          -- carousels로 대체
DROP TABLE IF EXISTS campaigns CASCADE;

-- 무거운 브랜드 메모리
DROP TABLE IF EXISTS bp_rating_feedback CASCADE;
DROP TABLE IF EXISTS brand_references CASCADE;
DROP TABLE IF EXISTS brand_offers CASCADE;
DROP TABLE IF EXISTS brand_audiences CASCADE;
DROP TABLE IF EXISTS brand_learnings CASCADE;
DROP TABLE IF EXISTS brand_key_visuals CASCADE;

-- 폰트 추천/페어링 (렌더는 Pretendard 고정)
DROP TABLE IF EXISTS brand_font_pairs CASCADE;
DROP TABLE IF EXISTS fonts CASCADE;

-- 버전 카탈로그(있다면)
DROP TABLE IF EXISTS prompt_versions CASCADE;
DROP TABLE IF EXISTS playbook_versions CASCADE;

-- 초기 스키마 잔재(001/002, 이미 대체됨)
DROP TABLE IF EXISTS creatives CASCADE;
DROP TABLE IF EXISTS best_practices CASCADE;
DROP TABLE IF EXISTS brand_assets CASCADE;

-- 더 이상 쓰지 않는 enum
DROP TYPE IF EXISTS campaign_status CASCADE;
DROP TYPE IF EXISTS creative_status CASCADE;
DROP TYPE IF EXISTS asset_type CASCADE;
DROP TYPE IF EXISTS font_category CASCADE;

-- api_usage는 유지하되 campaigns FK가 CASCADE로 사라짐(컬럼은 nullable로 잔존).
-- brands의 무거운 컬럼 정리(선택) — 존재할 때만.
ALTER TABLE brands DROP COLUMN IF EXISTS style_guide_json;
ALTER TABLE brands DROP COLUMN IF EXISTS uses_real_assets;

COMMIT;
