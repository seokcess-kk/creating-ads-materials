import { createClient } from "@supabase/supabase-js";

// service role 클라이언트. RLS를 우회하므로 다음 용도로만 사용:
//   - 내부 파이프라인(이미지 생성, 압축, 임베딩 등 서버 전용 작업)
//   - 배치/웹훅/크론
//   - 시스템 테이블(api_usage 집계 등)
// 사용자 요청에서 브랜드/캠페인을 직접 읽거나 쓸 때는 @/lib/supabase/server의
// createClient()를 써서 RLS가 적용되도록 할 것. Plan B에서 이 규칙을 ESLint로 강제할 예정.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
