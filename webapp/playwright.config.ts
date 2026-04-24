import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3000";
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // 로컬에서 dev 서버를 수동으로 띄운 뒤 실행하도록 기본 설정.
  // CI/자동화가 필요하면 webServer 옵션을 활성화해 next dev를 자동 기동한다.
});
