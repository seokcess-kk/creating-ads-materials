import { readdir, readFile } from "node:fs/promises";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const REPO_ROOT = join(PROJECT_ROOT, "..");
const FONTS_DIR = join(REPO_ROOT, "fonts");
const CATALOG_PATH = join(FONTS_DIR, "catalog.md");

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

interface CatalogEntry {
  family: string;
  category: string;
  tone_tags: string[];
  fileNamePattern?: string;
}

const CATEGORY_KEYWORDS: Record<string, string> = {
  "프리미엄/모던 산세리프": "premium_sans",
  "임팩트/디스플레이": "impact_display",
  "명조/세리프": "serif",
  "둥근/친근 산세리프": "rounded_sans",
  "손글씨/캘리그래피": "handwriting",
  "브랜드 전용 서체": "brand_exclusive",
  "장식/개성": "decorative",
};

const TONE_BY_CATEGORY: Record<string, string[]> = {
  premium_sans: ["modern", "premium", "clean"],
  impact_display: ["strong", "bold", "display"],
  serif: ["classic", "elegant", "luxury"],
  rounded_sans: ["friendly", "soft", "casual"],
  handwriting: ["emotional", "personal", "warm"],
  brand_exclusive: ["brand"],
  decorative: ["special", "accent"],
};

function parseCatalog(md: string): CatalogEntry[] {
  const lines = md.split("\n");
  const entries: CatalogEntry[] = [];
  let currentCategory = "";

  for (const line of lines) {
    const h2 = line.match(/^##\s+\d+\.\s+(.+?)(?:\s*\(|$)/);
    if (h2) {
      const raw = h2[1].trim();
      currentCategory =
        Object.keys(CATEGORY_KEYWORDS).find((k) => raw.includes(k.split("/")[0])) ?? "";
      continue;
    }
    const row = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*`([^`]+)`/);
    if (row && currentCategory) {
      const family = row[1].trim();
      const pattern = row[2].trim();
      const categoryKey = CATEGORY_KEYWORDS[currentCategory] ?? "premium_sans";
      entries.push({
        family,
        category: categoryKey,
        tone_tags: TONE_BY_CATEGORY[categoryKey] ?? [],
        fileNamePattern: pattern,
      });
    }
  }
  return entries;
}

interface FileMeta {
  family: string;
  weight: string | null;
  fullFileName: string;
}

function inferWeight(fileName: string): string | null {
  const weights = [
    "Thin",
    "ExtraLight",
    "UltraLight",
    "Light",
    "Regular",
    "Medium",
    "SemiBold",
    "DemiBold",
    "Bold",
    "ExtraBold",
    "Heavy",
    "Black",
    "ExtraBlack",
    "UltraBlack",
  ];
  for (const w of weights) {
    if (new RegExp(`[-_ ]${w}\\b`, "i").test(fileName)) return w;
    if (fileName.includes(w)) return w;
  }
  const short = fileName.match(/-([A-Z]{1,3})\.(ttf|otf|ttc)/i);
  if (short) return short[1];
  return null;
}

function inferFamilyAndWeight(
  fileName: string,
  catalogEntries: CatalogEntry[],
): { family: string; weight: string | null } {
  const stem = basename(fileName, extname(fileName));

  for (const entry of catalogEntries) {
    if (!entry.fileNamePattern) continue;
    const pattern = entry.fileNamePattern
      .replace(/\{[^}]+\}/g, "([A-Za-z0-9]+)")
      .replace(/\*/g, ".*");
    const re = new RegExp(`^${pattern}$`, "i");
    if (re.test(fileName)) {
      return { family: entry.family, weight: inferWeight(fileName) };
    }
  }

  const guess = stem.split(/[-_ ]/)[0];
  return { family: guess, weight: inferWeight(fileName) };
}

async function scanFontFiles(): Promise<FileMeta[]> {
  const files = await readdir(FONTS_DIR);
  const exts = new Set([".ttf", ".otf", ".TTF", ".OTF", ".ttc", ".TTC"]);
  return files
    .filter((f) => exts.has(extname(f)))
    .map((fullFileName) => ({
      family: "",
      weight: null,
      fullFileName,
    }));
}

async function main() {
  console.log("=== Tier 0 카탈로그 seed ===\n");

  const catalogMd = await readFile(CATALOG_PATH, "utf-8");
  const entries = parseCatalog(catalogMd);
  console.log(`카탈로그 패밀리 ${entries.length}개 파싱`);

  const files = await scanFontFiles();
  console.log(`폰트 파일 ${files.length}개 발견`);

  if (files.length === 0) {
    console.error(
      `폰트 파일이 없습니다. 'python scripts/setup_fonts.py'로 먼저 다운로드하세요.`,
    );
    process.exit(1);
  }

  let inserted = 0;
  let failed = 0;

  for (const f of files) {
    const { family, weight } = inferFamilyAndWeight(f.fullFileName, entries);
    const entry = entries.find((e) => e.family === family);

    const { error } = await supabase.from("fonts").upsert(
      {
        family,
        weight,
        style: /italic/i.test(f.fullFileName) ? "italic" : "normal",
        file_path: `fonts/${f.fullFileName}`,
        file_format: extname(f.fullFileName).slice(1).toLowerCase(),
        tier: "tier0",
        category: entry?.category ?? null,
        tone_tags: entry?.tone_tags ?? [],
        language_support: ["ko", "en"],
        recommended_roles: [],
        license_confirmed: true,
        license_note: null,
      },
      { onConflict: "family,weight,style,tier" },
    );

    if (error) {
      failed++;
      if (failed <= 5) console.error(`  ✗ ${f.fullFileName}:`, error.message);
    } else {
      inserted++;
    }
  }

  console.log(`\n완료: ${inserted}개 삽입, ${failed}개 실패`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
