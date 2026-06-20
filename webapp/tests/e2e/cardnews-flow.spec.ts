import { test, expect } from "@playwright/test";
import { loginWithCredentials } from "./auth-helper";

// 카드뉴스 v1 브라우저 E2E — 한 화면(원문 paste → 생성 → N장 캐러셀).
// throwaway 유저/브랜드(e2e-setup.ts)로 시드한 뒤 E2E_BRAND_ID로 직접 진입.

const email = process.env.PW_TEST_EMAIL;
const password = process.env.PW_TEST_PASSWORD;
const brandId = process.env.E2E_BRAND_ID;

const CONTENT = `※ 2026 스터디코어1.0 썸머스쿨 안내 ※

본 안내는 7월·8월 월 등록이 아닌, 썸머스쿨 기간만 별도로 등록하여 이용하는 학생을 위한 안내입니다.

■ 모집 안내
* 모집 인원: 30명 선착순
* 등록 대상: 썸머스쿨 기간만 별도 이용 희망 학생
※ 등록 확정은 구글폼 신청서 제출 완료 기준입니다.

▶ 신청서: https://forms.gle/EV3U6o6VPE6b4wX59
※ 신청 인원이 마감될 경우 이후 신청은 제한될 수 있습니다.
학교별 방학 기간이 상이하므로 등원 희망 기간도 신청서에 함께 기입해주시기 바랍니다.`;

test.describe("카드뉴스 v1 — 원문 → 캐러셀 E2E", () => {
  test.skip(!email || !password || !brandId, "PW_TEST_EMAIL/PASSWORD/E2E_BRAND_ID 미설정");
  // 아웃라인 + 배경 + N슬라이드 합성/업로드 때문에 넉넉히.
  test.setTimeout(300_000);

  test("원문 paste → 생성 → N장 슬라이드", async ({ page }) => {
    await loginWithCredentials(page, email!, password!);

    await page.goto(`/brands/${brandId}/cardnews`);
    await expect(
      page.getByRole("heading", { name: "카드뉴스 생성" }),
    ).toBeVisible({ timeout: 15_000 });

    // 원문 paste
    await page
      .getByPlaceholder("안내문·공지·소식 원문을 통째로 붙여넣으세요")
      .fill(CONTENT);

    // 생성
    await page.getByRole("button", { name: /카드뉴스 생성/ }).click();

    // 슬라이드 이미지가 나타날 때까지(생성 = 아웃라인+배경+합성+업로드)
    const slideImgs = page.locator('img[alt^="슬라이드"]');
    await expect(
      slideImgs.first(),
      "카드뉴스 슬라이드가 생성되어야 함",
    ).toBeVisible({ timeout: 240_000 });

    const count = await slideImgs.count();
    expect(count, "슬라이드가 4장 이상이어야 함").toBeGreaterThanOrEqual(4);
  });
});
