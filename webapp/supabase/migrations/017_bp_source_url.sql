-- Phase 2: URL-Paste 임포트용 source_url 필드
-- 외부 광고 라이브러리(Google ATC·Meta Ad Library·TikTok Creative Center 등)에서
-- 가져온 크리에이티브의 원본 광고 URL을 저장한다.
-- (brand_id, source_url) 부분 유니크로 같은 브랜드가 같은 광고를 중복 임포트하지 않게 한다.
-- 수동 업로드 BP는 source_url=NULL로 여러 건 허용.

ALTER TABLE brand_references
  ADD COLUMN source_url TEXT;

CREATE UNIQUE INDEX idx_brand_refs_source_url
  ON brand_references(brand_id, source_url)
  WHERE source_url IS NOT NULL;
