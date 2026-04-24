# E2E Tests (Playwright)

## 실행 전 준비

1. 브라우저 설치 (최초 1회)
   ```bash
   npx playwright install chromium
   ```
2. 앱이 `http://localhost:3000`에서 실행 중이어야 한다
   ```bash
   npm run dev
   ```
   다른 포트/호스트를 쓴다면 `E2E_BASE_URL=http://localhost:4000 npm run test:e2e`.

## 실행

```bash
npm run test:e2e            # 모든 spec
npm run test:e2e -- --ui    # 브라우저 UI 모드로 디버깅
```

## 로그인 플로우 테스트

`login-gate.spec.ts`의 두 번째 `describe`는 실제 Supabase 계정이 필요해 기본적으로 skip된다.
테스트 계정을 붙이려면:

```bash
PW_TEST_EMAIL=test@example.com PW_TEST_PASSWORD=xxxx npm run test:e2e
```

로컬 개발용 테스트 계정은 실서비스 DB와 분리된 Supabase 프로젝트에서 만드는 것을 권장한다.
