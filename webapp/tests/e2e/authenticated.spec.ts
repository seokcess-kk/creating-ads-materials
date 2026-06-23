import { expect, test } from "@playwright/test";
import { loginWithCredentials } from "./auth-helper";

const email = process.env.PW_TEST_EMAIL;
const password = process.env.PW_TEST_PASSWORD;

test.describe("인증 후 핵심 페이지 스모크", () => {
  test.skip(!email || !password, "PW_TEST_EMAIL / PW_TEST_PASSWORD 미설정");

  test.beforeEach(async ({ page }) => {
    await loginWithCredentials(page, email!, password!);
  });

  test("홈에 단일 이미지/캐러셀 진입 카드가 보인다", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "무엇을 만들까요?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /단일 이미지/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /캐러셀/ }).first(),
    ).toBeVisible();
  });

  test("사이드바 네비게이션이 동작한다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /단일 이미지/ }).first().click();
    await expect(page).toHaveURL(/\/generate$/);
    await page.getByRole("link", { name: /캐러셀/ }).first().click();
    await expect(page).toHaveURL(/\/carousel$/);
    await page.getByRole("link", { name: /갤러리/ }).first().click();
    await expect(page).toHaveURL(/\/gallery$/);
    await page.getByRole("link", { name: /브랜드/ }).first().click();
    await expect(page).toHaveURL(/\/brands$/);
  });

  test("로그아웃하면 /login으로 이동한다", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
