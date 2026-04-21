-- M-UX4: 로고 구조 재설계 — 4 고정 slot → 자유 갤러리
-- logo_urls_json { full?, icon?, light?, dark? } → logos_json [{ id, url, label?, is_primary }]

ALTER TABLE brand_identity
  ADD COLUMN logos_json JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 기존 데이터 마이그레이션:
-- full > light > dark > icon 우선순위로 정렬, 첫 번째를 is_primary=true
WITH expanded AS (
  SELECT
    bi.brand_id,
    jsonb_agg(
      jsonb_build_object(
        'id',         gen_random_uuid()::text,
        'url',        e.value,
        'label',      e.key,
        'is_primary', e.priority = 1
      ) ORDER BY e.priority
    ) AS logos
  FROM brand_identity bi,
    LATERAL (
      SELECT
        key,
        value,
        CASE key
          WHEN 'full'  THEN 1
          WHEN 'light' THEN 2
          WHEN 'dark'  THEN 3
          WHEN 'icon'  THEN 4
          ELSE 5
        END AS priority
      FROM jsonb_each_text(bi.logo_urls_json)
      WHERE value IS NOT NULL AND value <> ''
    ) e
  GROUP BY bi.brand_id
)
UPDATE brand_identity bi
SET logos_json = (
  SELECT
    -- priority 최저값(=1)을 is_primary로 재지정
    jsonb_agg(
      CASE
        WHEN (x.rn = 1) THEN jsonb_set(x.logo, '{is_primary}', 'true'::jsonb)
        ELSE jsonb_set(x.logo, '{is_primary}', 'false'::jsonb)
      END
      ORDER BY x.rn
    )
  FROM (
    SELECT
      logo,
      ROW_NUMBER() OVER () AS rn
    FROM jsonb_array_elements(e.logos) AS logo
  ) x
)
FROM expanded e
WHERE bi.brand_id = e.brand_id;

ALTER TABLE brand_identity DROP COLUMN logo_urls_json;
