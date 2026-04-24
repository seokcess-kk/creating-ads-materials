import { expect, test } from "@playwright/test";

// 인증 경계 스모크: 미인증 상태에서 보호된 경로로 접근하면 /login으로 리다이렉트되어야 한다.
// 실제 로그인 성공 플로우는 Supabase 계정이 필요하므로 env로 켠다.
//   PW_TEST_EMAIL=...  PW_TEST_PASSWORD=...  npm run test:e2e

test("미인증 루트 접근 시 /login으로 리다이렉트", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
  await expect(page.getByRole("heading", { name: /로그인/ })).toBeVisible();
});

test("미인증 브랜드 페이지 접근 시 redirect 파라미터가 설정된다", async ({ page }) => {
  await page.goto("/brands");
  await expect(page).toHaveURL(/\/login\?redirect=.+brands/);
});

test.describe("로그인 플로우 (credentials required)", () => {
  const email = process.env.PW_TEST_EMAIL;
  const password = process.env.PW_TEST_PASSWORD;

  test.skip(!email || !password, "PW_TEST_EMAIL / PW_TEST_PASSWORD 미설정");

  test("등록된 계정으로 로그인하면 대시보드로 이동", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("이메일").fill(email!);
    await page.getByLabel("비밀번호").fill(password!);
    await page.getByRole("button", { name: "로그인" }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/$|\/brands|\/campaigns/);
  });
});
