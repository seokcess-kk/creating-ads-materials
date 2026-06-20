import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "./auth-helper";

// 안내문(notice) 모드 브라우저 E2E — 실제 DB/route 계층을 검증한다.
// 엔진 E2E(scripts/e2e-notice.ts)가 생성 품질을 검증했고, 이 스펙은
// 위저드→캠페인 생성(신규 컬럼)→Strategy(게이트 우회)→Copy(notice 생성)의
// "라우트+DB+게이트" 경로를 실 서버로 확인한다.
//
// 실행:
//   1) webapp에서  npm run dev   (별도 터미널, http://localhost:3000)
//   2) PW_TEST_EMAIL / PW_TEST_PASSWORD 환경변수 설정 후
//      npx playwright test notice-flow.spec.ts

const email = process.env.PW_TEST_EMAIL;
const password = process.env.PW_TEST_PASSWORD;

const ANNOUNCEMENT = `※ 2026 스터디코어1.0 썸머스쿨 안내 ※

안녕하세요. 스터디코어1.0입니다.
본 안내 및 신청서는 7월·8월 월 등록이 아닌, 썸머스쿨 기간만 별도로 등록하여 이용하는 학생을 위한 안내입니다.

■ 모집 안내
* 모집 인원: 30명 선착순
* 등록 대상: 썸머스쿨 기간만 별도 이용 희망 학생
※ 등록 확정은 구글폼 신청서 제출 완료 기준입니다.

▶ 2026 썸머스쿨 신청서
https://forms.gle/EV3U6o6VPE6b4wX59
▶ 안내 공지
https://www.studycore.kr/notices/117bdb99-e3c6-4ddf-8385-365db638c82b

※ 신청 인원이 마감될 경우 이후 신청은 제한될 수 있습니다.
학교별 방학 기간이 상이하므로 등원 희망 기간도 신청서에 함께 기입해주시기 바랍니다.`;

test.describe("안내문(notice) 모드 — 라우트/DB/게이트 E2E", () => {
  test.skip(!email || !password, "PW_TEST_EMAIL / PW_TEST_PASSWORD 미설정");
  // LLM 호출(Strategy opus + Copy opus) 때문에 넉넉히.
  test.setTimeout(300_000);

  test("위저드→캠페인 생성→Strategy→Copy", async ({ page }) => {
    await loginWithCredentials(page, email!, password!);

    // 1) 캠페인 위저드로 이동 (E2E_BRAND_ID 주입 시 직접, 아니면 첫 브랜드 선택)
    const injectedBrandId = process.env.E2E_BRAND_ID;
    if (injectedBrandId) {
      await page.goto(`/brands/${injectedBrandId}/campaigns/new`);
    } else {
      await page.goto("/brands");
      const brandLink = page
        .locator('a[href^="/brands/"]:not([href$="/new"])')
        .first();
      await expect(brandLink, "브랜드가 1개 이상 필요합니다").toBeVisible({
        timeout: 15_000,
      });
      await brandLink.click();
      await page.waitForURL(/\/brands\/[0-9a-f-]{8,}/);
      const id = new URL(page.url()).pathname.split("/")[2];
      await page.goto(`/brands/${id}/campaigns/new`);
    }
    await expect(page.getByText("콘텐츠 유형 *")).toBeVisible({ timeout: 15_000 });

    // 2) 안내문 모드 토글 + 이름 + 원문 paste
    await page.getByRole("button", { name: /안내문/ }).click();
    await page
      .getByPlaceholder("예: 봄 신학기 전환 캠페인 3월")
      .fill("E2E 안내문 — 썸머스쿨");
    await page
      .getByPlaceholder("안내문/공지 원문을 통째로 붙여넣으세요")
      .fill(ANNOUNCEMENT);

    // notice 모드에서는 오퍼/페르소나 카드가 숨겨져야 한다(사전입력 불필요)
    await expect(page.getByText("오퍼 선택 *")).toHaveCount(0);

    // 3) 자동추출 → 위저드 검수 필드 노출 (extract 엔드포인트 검증)
    await page.getByRole("button", { name: /안내문 분석/ }).click();
    await expect(page.getByText("추출 정보 검수 — 수정 가능")).toBeVisible({
      timeout: 60_000,
    });
    // 핵심 슬롯이 채워졌는지(정원) 확인
    await expect(page.getByText("모집/정원")).toBeVisible();

    // 4) 자동화 수준 Manual — 각 단계를 수동 선택해 결정적으로 검증(자동 진행 방지)
    await page.locator("label").filter({ hasText: "Manual" }).first().click();

    // 5) 캠페인 생성 (notice 컬럼 + 게이트 우회 검증)
    await page.getByRole("button", { name: /캠페인 시작/ }).click();
    await page.waitForURL(/\/campaigns\/[0-9a-f-]{8,}/, { timeout: 30_000 });

    // 6) Strategy 생성 — offer/audience 없이 통과해야 함(게이트 완화 검증)
    await expect(page.getByRole("button", { name: "Strategy 생성" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Strategy 생성" }).click();
    // manual 모드 → 자동선택 없이 전략 카드 노출(각 카드에 "카피 더 보기")
    await expect(
      page.getByRole("button", { name: "카피 더 보기" }).first(),
      "Strategy가 게이트 우회로 생성되어야 함",
    ).toBeVisible({ timeout: 180_000 });

    // 7) 첫 전략 선택 + Copy 생성 (notice 카피)
    await page.getByRole("button", { name: "카피 더 보기" }).first().click();
    await expect(
      page.getByRole("button", { name: "이 카피 선택" }).first(),
      "notice 모드 Copy가 생성되어야 함",
    ).toBeVisible({ timeout: 180_000 });

    // 8) 카피 선택 → Visual 단계 활성화 토스트
    await page.getByRole("button", { name: "이 카피 선택" }).first().click();
    await expect(page.getByText(/Copy 선택/)).toBeVisible({ timeout: 15_000 });
  });
});
