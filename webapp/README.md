# Ad Studio — Creative Materials

AI 기반 광고 소재 제작 웹 앱. 브랜드 메모리를 중심으로 Strategy → Copy → Visual → Retouch → Compose → Ship의 6단계 파이프라인을 돌려 캠페인 소재를 반복 생성한다.

## Stack

- **Framework**: Next.js 16 (App Router, `src/proxy.ts` 기반 인증 게이트)
- **Language**: TypeScript, React 19
- **DB/Auth/Storage**: Supabase (Postgres + RLS + Storage)
- **Models**:
  - Claude (Anthropic) — Strategy, Copy, Vision validator, Retouch plan
  - Gemini 3 Pro Image Preview (Google) — Visual 생성, Retouch 실행
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Canvas**: `@napi-rs/canvas` — 서버 사이드 로고 합성, `sharp` — 이미지 전처리

## 환경 변수

`webapp/.env.local`에 다음 키가 필요하다. `src/lib/env.ts`에서 zod로 런타임 검증한다.

```env
# Anthropic / Google
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # 서버 전용 (AI 파이프라인/배치에서만 사용)
```

## 최초 셋업

```bash
cd webapp
npm install

# 1) Supabase 프로젝트 생성 후 migration 적용
#    Supabase CLI 또는 Studio SQL Editor에서 supabase/migrations/*.sql을 번호 순서대로 실행
#    최신: 018_rls_plan_a.sql, 019_storage_policies.sql (인증 경계)

# 2) Supabase Storage 버킷 생성 (public 권장)
#    - brand-assets
#    - brand-key-visuals
#    - generated-images

# 3) 초기 사용자 생성 — Supabase Studio → Authentication → Users → "Add user"
#    이메일/비밀번호 지정 후 Email Confirm 체크. 해당 계정으로 /login에서 접속한다.

# 4) 폰트 카탈로그 시드 (선택 — 텍스트 렌더링을 쓸 경우)
npm run seed:catalog    # fonts/catalog.md + fonts/*.woff2 를 DB에 등록
```

## 개발

```bash
npm run dev          # localhost:3000
npm run build
npm run start
npm run lint         # eslint (에러 0 / 경고 0 목표)
npm run test         # vitest unit tests
npm run test:e2e     # playwright smoke tests (dev 서버가 실행 중이어야 함)
```

## 주요 디렉터리

```
webapp/
├── src/
│   ├── proxy.ts                  # Next.js 16 proxy — /login 게이트
│   ├── app/
│   │   ├── login/                # 이메일·비밀번호 로그인
│   │   ├── api/                  # 서버 라우트 (campaigns/brands/fonts/auth)
│   │   ├── brands/               # 브랜드 메모리 관리
│   │   ├── campaigns/            # 캠페인 생성 위저드 + Stage UI
│   │   └── usage/                # API 사용량 대시보드
│   ├── components/
│   │   ├── campaign/             # 6단계 Stage/Gate 컴포넌트
│   │   ├── memory/               # Identity/Offer/Audience/Reference/Font 매니저
│   │   └── notifications/        # 진행 상황 토스트 + Activity Center
│   └── lib/
│       ├── auth.ts               # getCurrentUser / requireUser
│       ├── supabase/             # admin · server · client · proxy 클라이언트
│       ├── campaigns/            # 캠페인·run·stage·variant 모델 + CRUD
│       ├── memory/               # 브랜드 메모리 (identity/offer/audience/reference)
│       ├── prompts/              # Claude/Gemini 프롬프트 템플릿
│       ├── engines/              # 모델 호출 래퍼
│       ├── canvas/               # 서버 합성 로직
│       ├── storage/              # 업로드 유틸
│       └── hooks/                # 공용 훅 (useStateFromProps 등)
├── supabase/migrations/          # 001 ~ 019
└── scripts/                      # seed / dump CLI
```

## 인증 모델

현재 **Plan A**: `auth.uid() IS NOT NULL` 체크만 있는 단일 테넌트 공유 모드.

- `src/proxy.ts`가 미인증 요청을 `/login`으로 돌려보낸다
- RLS 정책(018)이 로그인된 사용자라면 모든 브랜드/캠페인을 읽고 쓸 수 있게 허용
- service role 클라이언트(`@/lib/supabase/admin`)는 AI 파이프라인·배치용. 사용자 요청 경로에서 직접 쓰지 말 것 (주석 참고)

**Plan B**(예정): `brands.owner_id` 추가 + 사용자별 스코프로 좁힘. 이때 `@/lib/supabase/server`로 세션 클라이언트 전환 필요.

## 파이프라인

각 캠페인은 `creative_runs` → `creative_stages`(6) → `creative_variants`의 트리로 저장된다.

| Stage    | 모델                  | 산출물                           |
| -------- | --------------------- | -------------------------------- |
| Strategy | Claude Opus          | 3개 대안 (angle/hook/value-prop) |
| Copy     | Claude Sonnet        | 5~8개 카피 변형 + 4축 self-critique |
| Visual   | Gemini 3 Pro Image   | 3장 이미지 + Claude Vision 검증  |
| Retouch  | Gemini 3 Pro Image   | base 이미지 편집 변형            |
| Compose  | `@napi-rs/canvas`    | 로고 합성된 최종 시안            |
| Ship     | —                     | 레이팅·노트 기록, 캠페인 종료    |

각 Stage는 `BatchRegenerateBox`로 batch 단위 재생성/복원 가능(`stage_invalidation` 정책).

## 테스트

- **Unit** (`vitest`): `src/**/*.test.ts(x)` — 순수 로직과 훅 검증
- **E2E** (`playwright`): `tests/e2e/**/*.spec.ts` — 로그인 게이트 스모크
- CI 게이트: `npm run lint -- --max-warnings=0 && npm run test && npm run build`

테스트 DB는 별도 Supabase 프로젝트를 권장한다. 실서비스 데이터를 건드리지 않도록 `.env.test.local`로 키를 분리하라.

## 참고

- `fonts/catalog.md` — 사용 가능한 폰트 1,072종 카탈로그
- `supabase/migrations/018_rls_plan_a.sql` — 현재 RLS 모델
- `AGENTS.md` — Next.js 16 주의사항 (middleware → proxy 등)
