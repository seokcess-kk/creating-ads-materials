import { expect, test } from "@playwright/test";
import { loginWithCredentials } from "./auth-helper";

const email = process.env.PW_TEST_EMAIL;
const password = process.env.PW_TEST_PASSWORD;

test.describe("인증 후 핵심 페이지 스모크", () => {
  test.skip(!email || !password, "PW_TEST_EMAIL / PW_TEST_PASSWORD 미설정");

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, email!, password!);
  });

  test("대시보드에 주요 지표 카드가 보인다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Brands", { exact: true })).toBeVisible();
    await expect(page.getByText("Campaigns", { exact: true })).toBeVisible();
  });

  test("사이드바의 핵심 네비게이션이 동작한다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Brands/ }).first().click();
    await expect(page).toHaveURL(/\/brands$/);
    await page.getByRole("link", { name: /Campaigns/ }).first().click();
    await expect(page).toHaveURL(/\/campaigns/);
    await page.getByRole("link", { name: /Usage/ }).first().click();
    await expect(page).toHaveURL(/\/usage/);
  });

  test("브랜드 생성 폼으로 이동할 수 있다", async ({ page }) => {
    await page.goto("/brands");
    const newButton = page.getByRole("link", { name: /새 브랜드|브랜드 추가|New|추가/i }).first();
    // 빈 목록이면 페이지 내 CTA, 아니면 /brands/new 직접
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click();
    } else {
      await page.goto("/brands/new");
    }
    await expect(page).toHaveURL(/\/brands\/new/);
  });

  test("로그아웃하면 /login으로 이동한다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
