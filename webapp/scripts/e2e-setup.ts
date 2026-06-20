/**
 * 안내문 E2E용 임시 유저/브랜드 시드 (서비스 롤).
 * 사용자 실계정 비밀번호 없이, 전용 throwaway 계정으로 브라우저 E2E를 돌리기 위함.
 * 자격증명은 OS temp 파일에만 기록(레포/채팅에 비밀번호 노출 없음). teardown이 정리.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP = join(__dirname, "..");
const REPO_ROOT = join(WEBAPP, "..");
loadEnv({ path: join(WEBAPP, ".env.local") });
loadEnv({ path: join(REPO_ROOT, ".env") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락");
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const stamp = Date.now();
  const email = `e2e-notice-${stamp}@example.com`;
  const password = `${randomBytes(12).toString("base64url")}Aa1!`;

  const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userErr || !created.user) {
    throw new Error(`테스트 유저 생성 실패: ${userErr?.message}`);
  }
  const userId = created.user.id;

  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .insert({ name: `E2E 테스트 브랜드 ${stamp}`, owner_id: userId })
    .select()
    .single();
  if (brandErr || !brand) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`테스트 브랜드 생성 실패: ${brandErr?.message}`);
  }

  const credPath = join(tmpdir(), "e2e-notice-creds.json");
  writeFileSync(
    credPath,
    JSON.stringify({ email, password, userId, brandId: brand.id }),
  );

  console.log("SETUP_OK");
  console.log("EMAIL=" + email);
  console.log("BRAND_ID=" + brand.id);
  console.log("USER_ID=" + userId);
  console.log("CREDS_PATH=" + credPath);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
