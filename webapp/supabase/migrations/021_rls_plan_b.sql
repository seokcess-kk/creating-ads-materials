-- Plan B 2단계: RLS를 owner_id 기반으로 좁힘
--   - brands: 본인 소유 row만 CRUD
--   - 하위 테이블: brands(owner) 조인으로 상속
--   - fonts / playbook_versions / prompt_versions: 공유 SELECT 유지
--   - api_usage: 본인 usage만 보이도록 user_id 매칭 (user_id 컬럼이 있다면)

BEGIN;

-- 1) 기존 Plan A 정책 제거
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
    END IF;
  END LOOP;
END $$;

-- 2) brands: owner_id = auth.uid() 기준
CREATE POLICY "brands_owner_all" ON public.brands
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 3) 하위 테이블: brands 조인
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'brand_identity',
    'brand_offers',
    'brand_audiences',
    'brand_references',
    'brand_learnings',
    'brand_font_pairs',
    'brand_key_visuals'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format(
        'CREATE POLICY "%s_via_brand_owner" ON public.%I
           FOR ALL
           TO authenticated
           USING (EXISTS (
             SELECT 1 FROM public.brands b
             WHERE b.id = %I.brand_id AND b.owner_id = auth.uid()
           ))
           WITH CHECK (EXISTS (
             SELECT 1 FROM public.brands b
             WHERE b.id = %I.brand_id AND b.owner_id = auth.uid()
           ))',
        t, t, t, t
      );
    END IF;
  END LOOP;
END $$;

-- 4) campaigns: brands 조인
CREATE POLICY "campaigns_via_brand_owner" ON public.campaigns
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = campaigns.brand_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = campaigns.brand_id AND b.owner_id = auth.uid()
  ));

-- 5) creative_runs: campaigns 조인
CREATE POLICY "creative_runs_via_campaign_owner" ON public.creative_runs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.brands b ON b.id = c.brand_id
    WHERE c.id = creative_runs.campaign_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.brands b ON b.id = c.brand_id
    WHERE c.id = creative_runs.campaign_id AND b.owner_id = auth.uid()
  ));

-- 6) creative_stages: runs 조인
CREATE POLICY "creative_stages_via_run_owner" ON public.creative_stages
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.creative_runs r
    JOIN public.campaigns c ON c.id = r.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE r.id = creative_stages.run_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.creative_runs r
    JOIN public.campaigns c ON c.id = r.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE r.id = creative_stages.run_id AND b.owner_id = auth.uid()
  ));

-- 7) creative_variants: stages 조인
CREATE POLICY "creative_variants_via_stage_owner" ON public.creative_variants
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.creative_stages s
    JOIN public.creative_runs r ON r.id = s.run_id
    JOIN public.campaigns c ON c.id = r.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE s.id = creative_variants.stage_id AND b.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.creative_stages s
    JOIN public.creative_runs r ON r.id = s.run_id
    JOIN public.campaigns c ON c.id = r.campaign_id
    JOIN public.brands b ON b.id = c.brand_id
    WHERE s.id = creative_variants.stage_id AND b.owner_id = auth.uid()
  ));

-- 8) bp_rating_feedback: brand_references 경유
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bp_rating_feedback') THEN
    EXECUTE $q$
      CREATE POLICY "bp_rating_feedback_via_reference_owner" ON public.bp_rating_feedback
        FOR ALL
        TO authenticated
        USING (EXISTS (
          SELECT 1 FROM public.brand_references r
          JOIN public.brands b ON b.id = r.brand_id
          WHERE r.id = bp_rating_feedback.reference_id AND b.owner_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.brand_references r
          JOIN public.brands b ON b.id = r.brand_id
          WHERE r.id = bp_rating_feedback.reference_id AND b.owner_id = auth.uid()
        ))
    $q$;
  END IF;
END $$;

-- 9) api_usage: user_id 컬럼이 없으므로 당분간 authenticated 공유 유지
--    Plan B 후속 마이그레이션에서 user_id 컬럼 추가 + 좁힐 예정
CREATE POLICY "api_usage_authenticated_all" ON public.api_usage
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 10) Storage 객체 정책은 019가 이미 authenticated 기반 — 경로 기반 owner 좁힘은
--     향후 brands 소유권 확인으로 확장할 수 있으나 지금은 생략
--     (session client로 업로드·삭제 시 테이블 RLS가 보호)

COMMIT;
