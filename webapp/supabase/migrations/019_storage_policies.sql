-- Storage RLS Plan A: 로그인된 사용자만 접근
--   - brand-assets / brand-key-visuals / generated-images 버킷
--   - 공개 URL은 getPublicUrl()로 계속 동작 (버킷이 public이면 RLS는 object 조작에만 적용)
--   - 객체 쓰기/삭제는 authenticated 필수
--
-- 버킷은 Supabase Studio 또는 별도 init 스크립트에서 public으로 생성되어 있다고 가정.
-- 이 마이그레이션은 storage.objects에 대한 RLS 정책만 다룬다.

BEGIN;

-- 버킷 allow-list (존재하지 않으면 정책 자체는 무해)
DO $$
DECLARE b text;
BEGIN
  FOR b IN SELECT unnest(ARRAY['brand-assets', 'brand-key-visuals', 'generated-images'])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "objects_%s_auth_read" ON storage.objects',
      replace(b, '-', '_')
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "objects_%s_auth_write" ON storage.objects',
      replace(b, '-', '_')
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "objects_%s_auth_update" ON storage.objects',
      replace(b, '-', '_')
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "objects_%s_auth_delete" ON storage.objects',
      replace(b, '-', '_')
    );

    EXECUTE format(
      $q$CREATE POLICY "objects_%s_auth_read" ON storage.objects
           FOR SELECT TO authenticated
           USING (bucket_id = %L)$q$,
      replace(b, '-', '_'), b
    );
    EXECUTE format(
      $q$CREATE POLICY "objects_%s_auth_write" ON storage.objects
           FOR INSERT TO authenticated
           WITH CHECK (bucket_id = %L)$q$,
      replace(b, '-', '_'), b
    );
    EXECUTE format(
      $q$CREATE POLICY "objects_%s_auth_update" ON storage.objects
           FOR UPDATE TO authenticated
           USING (bucket_id = %L)
           WITH CHECK (bucket_id = %L)$q$,
      replace(b, '-', '_'), b, b
    );
    EXECUTE format(
      $q$CREATE POLICY "objects_%s_auth_delete" ON storage.objects
           FOR DELETE TO authenticated
           USING (bucket_id = %L)$q$,
      replace(b, '-', '_'), b
    );
  END LOOP;
END $$;

COMMIT;
