import { mkdir, writeFile, access, copyFile, stat } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import { TIER1_FAMILIES } from "../src/lib/fonts/tier1-registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PROJECT_ROOT, "..");
const LOCAL_FONTS_DIR = join(REPO_ROOT, "fonts");
const PUBLIC_FONTS_DIR = join(PROJECT_ROOT, "public", "fonts");

const envPath = join(PROJECT_ROOT, ".env.local");
loadEnv({ path: envPath });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`\n환경변수 누락. 다음 파일을 확인하세요:\n  ${envPath}\n`);
  console.error(`필요한 키: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string, dest: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

interface Resolved {
  savedPath: string;
  size: number;
  via: "exists" | "cdn" | "local";
  format: string;
}

async function resolveFontFile(
  cdnUrl: string,
  targetPath: string,
  localCandidates: string[],
): Promise<Resolved | null> {
  if (await exists(targetPath)) {
    const s = await stat(targetPath);
    return { savedPath: targetPath, size: s.size, via: "exists", format: extname(targetPath).slice(1) };
  }

  try {
    const size = await download(cdnUrl, targetPath);
    return { savedPath: targetPath, size, via: "cdn", format: extname(targetPath).slice(1) };
  } catch (err) {
    const msg = (err as Error).message;
    for (const candidate of localCandidates) {
      const srcPath = join(LOCAL_FONTS_DIR, candidate);
      if (await exists(srcPath)) {
        const ext = extname(candidate).slice(1).toLowerCase();
        const altTarget = targetPath.replace(/\.woff2$/i, `.${ext}`);
        await mkdir(dirname(altTarget), { recursive: true });
        await copyFile(srcPath, altTarget);
        const s = await stat(altTarget);
        console.log(`    ↳ CDN 실패(${msg}) → 로컬 ${candidate} 복사`);
        return { savedPath: altTarget, size: s.size, via: "local", format: ext };
      }
    }
    console.error(`    ✗ CDN 실패(${msg}), 로컬 후보 모두 없음`);
    return null;
  }
}

function toWebPath(savedPath: string): string {
  const rel = savedPath.slice(PUBLIC_FONTS_DIR.length).replace(/\\/g, "/");
  return `/fonts${rel.startsWith("/") ? rel : "/" + rel}`;
}

async function main() {
  console.log("=== Tier 1 폰트 seed 시작 ===\n");
  console.log(`로컬 fonts/ 경로: ${LOCAL_FONTS_DIR}`);
  console.log(`public/fonts/ 경로: ${PUBLIC_FONTS_DIR}\n`);

  let totalOk = 0;
  let totalFail = 0;

  for (const fam of TIER1_FAMILIES) {
    console.log(`[${fam.family}] ${fam.weights.length} weights`);
    for (const w of fam.weights) {
      const target = join(PUBLIC_FONTS_DIR, w.publicFile);
      const resolved = await resolveFontFile(w.cdnUrl, target, w.localCandidates);
      if (!resolved) {
        totalFail++;
        continue;
      }

      const webPath = toWebPath(resolved.savedPath);
      const { error } = await supabase.from("fonts").upsert(
        {
          family: fam.family,
          weight: w.name,
          style: "normal",
          file_path: webPath,
          file_format: resolved.format,
          tier: "tier1",
          category: fam.category,
          tone_tags: fam.tone_tags,
          language_support: fam.language_support,
          recommended_roles: fam.recommended_roles,
          license_confirmed: true,
          license_note: fam.license,
        },
        { onConflict: "family,weight,style,tier" },
      );

      if (error) {
        console.error(`  ✗ ${w.name} DB insert 실패:`, error.message);
        totalFail++;
      } else {
        const sizeKb = (resolved.size / 1024).toFixed(1);
        const label = resolved.via === "exists" ? "이미 존재" : resolved.via === "cdn" ? "CDN" : "로컬 복사";
        console.log(`  ↪ ${w.name}: ${sizeKb}KB (${label}) → ${webPath}`);
        totalOk++;
      }
    }
  }

  console.log(`\n=== 완료: 성공 ${totalOk}, 실패 ${totalFail} ===`);
  if (totalFail > 0) {
    console.log(`\n실패한 패밀리는 로컬 fonts/ 디렉토리에 원본이 없어서 fallback도 불가했습니다.`);
    console.log(`python scripts/setup_fonts.py 완료 후 재시도하세요.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
