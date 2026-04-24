-- Plan B 1단계: brands.owner_id 도입
--   - 컬럼 추가 (nullable)
--   - 기존 row 백필: 가장 오래된 auth.users 한 명에게 귀속
--   - NOT NULL 전환 + 인덱스
--   - 생성 트리거로 향후 insert 시 owner_id를 auth.uid()로 자동 세팅
--
-- RLS는 021에서 좁힌다. 이 단계까지는 Plan A(공유)가 유효.

BEGIN;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 백필: 기존 brands의 owner_id를 가장 먼저 가입한 auth 사용자에게 귀속.
-- 운영 시엔 DEFAULT_OWNER_EMAIL로 명시하고 싶다면 아래 UPDATE를 조정하라.
DO $$
DECLARE seed_uid UUID;
BEGIN
  SELECT id INTO seed_uid FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF seed_uid IS NOT NULL THEN
    UPDATE public.brands SET owner_id = seed_uid WHERE owner_id IS NULL;
  END IF;
END $$;

-- 백필 후에도 NULL이 남아 있다면(= auth.users가 비어 있다면) 마이그레이션 실패 처리.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.brands WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION
      'brands.owner_id 백필 실패 — auth.users에 최소 1명의 사용자를 먼저 생성하세요';
  END IF;
END $$;

ALTER TABLE public.brands ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brands_owner_id ON public.brands(owner_id);

-- INSERT 시 owner_id 미지정이면 현재 세션의 auth.uid()로 자동 세팅
CREATE OR REPLACE FUNCTION public.set_brand_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS brands_set_owner_id ON public.brands;
CREATE TRIGGER brands_set_owner_id
  BEFORE INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_brand_owner_id();

COMMIT;
