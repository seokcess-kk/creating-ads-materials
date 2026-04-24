-- RLS Plan A: 단일 테넌트 (로그인한 사용자는 모든 데이터를 공유)
--   - owner_id 컬럼 추가 없이 auth.uid() IS NOT NULL 만 요구
--   - service role은 RLS를 우회하므로 기존 admin 클라이언트 코드는 그대로 동작
--   - 추후 Plan B에서 brands.owner_id 추가 → 정책을 좁힐 예정
--
-- 참고: fonts/playbook_versions/prompt_versions는 공유 리소스로 둔다.

BEGIN;

-- 1) RLS 활성화
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'brands',
    'brand_identity',
    'brand_offers',
    'brand_audiences',
    'brand_references',
    'brand_learnings',
    'brand_font_pairs',
    'brand_key_visuals',
    'fonts',
    'playbook_versions',
    'prompt_versions',
    'campaigns',
    'creative_runs',
    'creative_stages',
    'creative_variants',
    'api_usage',
    'bp_rating_feedback'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 2) authenticated 역할에 read/write 권한 (RLS로 실제 제어)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'brands',
    'brand_identity',
    'brand_offers',
    'brand_audiences',
    'brand_references',
    'brand_learnings',
    'brand_font_pairs',
    'brand_key_visuals',
    'campaigns',
    'creative_runs',
    'creative_stages',
    'creative_variants',
    'api_usage',
    'bp_rating_feedback'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- fonts / playbook_versions / prompt_versions: 공유 읽기만 허용
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['fonts', 'playbook_versions', 'prompt_versions'])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- 3) 정책: authenticated 세션이 있으면 전체 read/write 허용 (Plan A)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'brands',
    'brand_identity',
    'brand_offers',
    'brand_audiences',
    'brand_references',
    'brand_learnings',
    'brand_font_pairs',
    'brand_key_visuals',
    'campaigns',
    'creative_runs',
    'creative_stages',
    'creative_variants',
    'api_usage',
    'bp_rating_feedback'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_all" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "%s_authenticated_all" ON public.%I
           FOR ALL
           TO authenticated
           USING (auth.uid() IS NOT NULL)
           WITH CHECK (auth.uid() IS NOT NULL)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- 공유 리소스는 SELECT만
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['fonts', 'playbook_versions', 'prompt_versions'])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_select" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "%s_authenticated_select" ON public.%I
           FOR SELECT
           TO authenticated
           USING (auth.uid() IS NOT NULL)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
