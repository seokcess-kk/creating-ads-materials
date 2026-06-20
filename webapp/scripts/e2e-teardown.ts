/**
 * e2e-setup.ts가 만든 임시 유저/브랜드 정리.
 * 브랜드 삭제는 campaigns/runs/stages/variants를 FK CASCADE로 함께 제거한다.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBAPP = join(__dirname, "..");
const REPO_ROOT = join(WEBAPP, "..");
loadEnv({ path: join(WEBAPP, ".env.local") });
loadEnv({ path: join(REPO_ROOT, ".env") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("env 누락");
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const credPath = join(tmpdir(), "e2e-notice-creds.json");
  let creds: { userId: string; brandId: string };
  try {
    creds = JSON.parse(readFileSync(credPath, "utf8"));
  } catch {
    console.log("creds 파일 없음 — 정리 건너뜀");
    return;
  }

  const { error: brandErr } = await supabase.from("brands").delete().eq("id", creds.brandId);
  if (brandErr) console.warn("브랜드 삭제 경고:", brandErr.message);

  const { error: userErr } = await supabase.auth.admin.deleteUser(creds.userId);
  if (userErr) console.warn("유저 삭제 경고:", userErr.message);

  console.log("TEARDOWN_OK");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
