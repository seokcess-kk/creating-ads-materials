# Vercel 배포 가이드

## 필수 사전 조건

- **Vercel Pro 플랜** — Hobby는 함수 실행 10초 제한으로 Visual(240s)·Retouch(180s)·Copy(120s) 실행 불가
- Supabase 프로젝트 + 마이그레이션 001~006 모두 적용 완료
- Storage 버킷 **public read** 설정: `brand-assets`, `generated-images`

---

## 1. Vercel 프로젝트 생성

1. https://vercel.com/new 접속
2. GitHub 저장소 `creating-ads-materials` 선택 → **Import**
3. **Configure Project**:
   - Framework Preset: **Next.js** (자동 감지)
   - **Root Directory**: `webapp` ← 반드시 설정 (모노레포 구조)
   - Build Command: 기본값 (`next build`)
   - Output Directory: 기본값

## 2. 환경변수 세팅

Vercel 프로젝트 → Settings → Environment Variables → 다음 5개 추가 (Production + Preview + Development):

```
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

**주의**: `NEXT_PUBLIC_*`은 빌드 타임 embed, 나머지는 런타임. 모두 정확히 입력.

## 3. Deploy

`Deploy` 버튼 클릭 → 빌드 시작 (약 3~5분).

## 4. 배포 후 확인 체크리스트

### 4.1 기본 동작
- [ ] 루트 페이지 로드: `https://<your-domain>.vercel.app/`
- [ ] `/brands` → 목록 표시
- [ ] Sidebar에 Dashboard / Brands / Usage 3개 메뉴

### 4.2 파이프라인 E2E
- [ ] 파일럿 브랜드로 새 캠페인 → Strategy → Copy → Visual → Retouch → Compose → Ship
- [ ] `/usage`에 호출 기록 실시간 누적 확인

### 4.3 예상 이슈
| 증상 | 원인 | 해결 |
|---|---|---|
| Visual 생성 **Cannot find native binding** | Canvas linux 바이너리 미포함 | `outputFileTracingIncludes`에 `canvas-linux-x64-*` 포함 확인 |
| Compose에서 **한글 폰트 깨짐** | 서버 환경에 Tier 0 폰트 없음 | Tier 1 폰트(Pretendard 등) 사용 권장 (public/fonts/) |
| **504 Gateway Timeout** | maxDuration 부족 | `vercel.json` 함수 설정 확인, Pro 플랜 활성 확인 |
| **Bucket not found** | Supabase Storage 버킷 public 미설정 | 대시보드 → Storage → bucket → Public 활성화 |
| 이미지 URL 401 | Storage RLS 정책 | public bucket으로 전환 또는 RLS 허용 |
| **환경변수 검증 실패** | 5개 키 중 누락 | Vercel Env 재확인, 저장 후 재배포 |

## 5. 운영 팁

### 5.1 비용 관리
- `/usage` 페이지에서 이번 달 지출 확인
- Claude Opus 호출이 대부분 비용. Strategy·Copy·Vision validator 각 $0.05~0.15
- Gemini Image 장당 $0.04

### 5.2 함수 타임아웃 조정
`vercel.json`의 `maxDuration` 값이 실제 실행 시간보다 충분한지 모니터링.
- Pro 플랜 기본 최대: 60초
- **300초까지 확장**: Function Configuration에서 Advanced 옵션 활성화

### 5.3 Fluid Compute (권장)
Pro 사용자는 Fluid Compute 활성화 권장.
- 콜드 스타트 단축
- 동시 요청 효율 처리
- 긴 실행 시간 안정성 향상

## 6. 도메인 연결 (선택)

Settings → Domains → Add → DNS CNAME/A record로 커스텀 도메인 연결.

## 7. 모니터링

- **Logs**: Vercel Dashboard → Logs (실시간)
- **Usage**: 앱 내 `/usage`
- **Errors**: 500 발생 시 서버 콘솔 로그 확인

---

## 부록: Supabase 마이그레이션 순서

전체 새 프로젝트 기준 순서:

```
001_initial_schema.sql         (대체됨, 건너뜀)
002_brand_assets_redesign.sql  (대체됨, 건너뜀)
003_creative_system.sql        ← 필수, 스키마 전면 교체
004_campaign_execution.sql     ← 필수
005_run_rating.sql             ← 필수
006_api_usage.sql              ← 필수
```

**신규 배포**: 003부터 순차 적용 (기존 테이블 drop되므로 데이터 없는 상태에서).

## 부록: 폰트 seed (선택)

Vercel 서버에선 `/fonts/` 디렉토리 접근 불가 (gitignore됨). 서버 측 Canvas 합성에 필요한 폰트는:

1. **public/fonts/ Tier 1 폰트로 커버** (이미 repo에 포함, 배포 시 자동 번들)
2. 추가 폰트 필요 시 Supabase Storage `brand-fonts` 버킷에 업로드 후 Tier 2로 등록
