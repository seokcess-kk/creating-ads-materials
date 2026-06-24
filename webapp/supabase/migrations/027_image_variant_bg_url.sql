-- M27: 단일 이미지 후보(overlay)의 재합성용 배경 URL 보존 (additive)
--   카피/로고/CTA 수정 시 이미지 모델 재호출 없이 renderComposite만으로 갱신할 수 있도록
--   텍스트 없는 배경 URL을 행에 보존한다. carousel_slides.bg_url(025)과 동형.
--   full/edit 후보는 텍스트가 이미지에 베이킹되어 NULL(재합성 불가).

BEGIN;

ALTER TABLE image_variants ADD COLUMN IF NOT EXISTS bg_url TEXT;

COMMIT;
