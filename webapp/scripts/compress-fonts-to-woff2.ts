import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, rm, readdir, stat } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
// @ts-expect-error — wawoff2 has no types
import wawoff2 from "wawoff2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_FONTS_DIR = join(PROJECT_ROOT, "public", "fonts");
const envPath = join(PROJECT_ROOT, ".env.local");
loadEnv({ path: envPath });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`환경변수 누락: ${envPath}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function listFontFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listFontFiles(p)));
    } else if (/\.(ttf|otf)$/i.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function toWebPath(absPath: string): string {
  const rel = absPath.slice(PUBLIC_FONTS_DIR.length).replace(/\\/g, "/");
  return `/fonts${rel.startsWith("/") ? rel : "/" + rel}`;
}

async function main() {
  console.log("=== ttf/otf → woff2 변환 시작 ===\n");

  // 1. Noto Sans KR 디렉토리 통째로 삭제 (32MB 절약, 프리셋 미참조)
  const notoDir = join(PUBLIC_FONTS_DIR, "noto-sans-kr");
  try {
    await stat(notoDir);
    await rm(notoDir, { recursive: true, force: true });
    console.log("✓ noto-sans-kr 디렉토리 제거 (32MB 절약)");
    const { error } = await supabase
      .from("fonts")
      .delete()
      .eq("family", "Noto Sans KR")
      .eq("tier", "tier1");
    if (error) console.error("  DB 삭제 실패:", error.message);
    else console.log("  Noto Sans KR tier1 row DB 삭제");
  } catch {
    console.log("- noto-sans-kr 디렉토리 없음 (skip)");
  }

  // 2. 나머지 ttf/otf 파일 변환
  const files = await listFontFiles(PUBLIC_FONTS_DIR);
  console.log(`\n변환 대상: ${files.length}개 ttf/otf\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  let ok = 0;
  let fail = 0;

  for (const absPath of files) {
    const ext = extname(absPath).toLowerCase();
    const name = basename(absPath);
    const oldWebPath = toWebPath(absPath);
    const newAbs = absPath.slice(0, -ext.length) + ".woff2";
    const newWebPath = toWebPath(newAbs);

    try {
      const input = await readFile(absPath);
      const compressed = Buffer.from(await wawoff2.compress(input));
      await writeFile(newAbs, compressed);

      const origKB = (input.length / 1024).toFixed(1);
      const newKB = (compressed.length / 1024).toFixed(1);
      const ratio = ((1 - compressed.length / input.length) * 100).toFixed(0);
      console.log(`  ${name}: ${origKB}KB → ${newKB}KB (-${ratio}%)`);

      // DB file_path 업데이트 (tier1만)
      const { error } = await supabase
        .from("fonts")
        .update({ file_path: newWebPath, file_format: "woff2" })
        .eq("file_path", oldWebPath)
        .eq("tier", "tier1");
      if (error) {
        console.error(`    DB 업데이트 실패: ${error.message}`);
        fail += 1;
        continue;
      }

      // 원본 ttf/otf 삭제
      await rm(absPath);

      totalOriginal += input.length;
      totalCompressed += compressed.length;
      ok += 1;
    } catch (e) {
      console.error(`  ✗ ${name}: ${(e as Error).message}`);
      fail += 1;
    }
  }

  const savedMB = ((totalOriginal - totalCompressed) / 1024 / 1024).toFixed(1);
  const origMB = (totalOriginal / 1024 / 1024).toFixed(1);
  const newMB = (totalCompressed / 1024 / 1024).toFixed(1);
  console.log(`\n=== 완료: ${ok}개 변환, ${fail}개 실패 ===`);
  console.log(`ttf/otf 합계 ${origMB}MB → woff2 합계 ${newMB}MB (절약 ${savedMB}MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
