import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { scrapeTopAds, type ScrapedAdCard } from "./lib/tiktok-cc-scraper";
import { rankToPerformanceScore } from "./lib/rank-to-score";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "..", ".env.local") });

interface CliOptions {
  brand: string;
  listUrl: string;
  baseUrl: string;
  limit: number;
  headless: boolean;
  dryRun: boolean;
  cardSelector?: string;
  imageSelector?: string;
  linkSelector?: string;
  advertiserSelector?: string;
  weight: number;
}

function parseArgs(argv: string[]): CliOptions {
  const map = new Map<string, string>();
  const flags = new Set<string>();
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v === undefined) flags.add(k);
      else map.set(k, v);
    }
  }
  if (flags.has("help") || (!map.has("brand") && argv.length > 0 && !flags.has("dry-run"))) {
    printHelp();
    process.exit(0);
  }
  const brand = map.get("brand");
  if (!brand) {
    console.error("필수 인자 누락: --brand=<brandId>");
    printHelp();
    process.exit(1);
  }
  const region = map.get("region") ?? "KR";
  const period = map.get("period") ?? "7";
  const industry = map.get("industry") ?? "";
  const defaultList = new URL(
    "https://ads.tiktok.com/business/creativecenter/inspiration/popular/pad/en",
  );
  defaultList.searchParams.set("period", period);
  defaultList.searchParams.set("region", region);
  if (industry) defaultList.searchParams.set("industry", industry);
  return {
    brand,
    listUrl: map.get("list-url") ?? defaultList.toString(),
    baseUrl: map.get("base-url") ?? "http://localhost:3000",
    limit: Number(map.get("limit") ?? "20"),
    headless: !flags.has("headed"),
    dryRun: flags.has("dry-run"),
    cardSelector: map.get("card-selector"),
    imageSelector: map.get("image-selector"),
    linkSelector: map.get("link-selector"),
    advertiserSelector: map.get("advertiser-selector"),
    weight: Number(map.get("weight") ?? "55"),
  };
}

function printHelp(): void {
  console.log(`
TikTok Creative Center Top Ads 덤프

사용법:
  npm run dump:tiktok-cc -- --brand=<brandId> [옵션]

필수:
  --brand=<uuid>            저장할 브랜드 ID

주요 옵션:
  --region=KR               지역 필터 (기본 KR)
  --period=7                기간(일), 7/30/120 (기본 7)
  --industry=<slug>         산업 필터 (선택)
  --list-url=<url>          TikTok CC 리스트 URL 직접 지정 (위 region/period/industry 무시)
  --limit=20                가져올 카드 수 (기본 20)
  --weight=55               저장 시 기본 weight (기본 55)
  --base-url=http://...     웹앱 base URL (기본 http://localhost:3000)
  --headed                  브라우저 창 띄우기 (디버깅용)
  --dry-run                 API 호출 없이 스크랩 결과만 출력
  --card-selector=<css>     레이아웃 변경 시 카드 셀렉터 override
  --image-selector=<css>    카드 내부 이미지 셀렉터 override
  --link-selector=<css>     상세 링크 셀렉터 override
  --advertiser-selector=<css> 광고주 텍스트 셀렉터 override

예:
  npm run dump:tiktok-cc -- --brand=abc-123 --region=KR --period=7 --limit=30
  npm run dump:tiktok-cc -- --brand=abc-123 --dry-run --headed
`);
}

interface ImportResult {
  status: "ok" | "skip-dup" | "error";
  message?: string;
  referenceId?: string;
}

async function importCard(
  opt: CliOptions,
  card: ScrapedAdCard,
  performanceScore: 1 | 2 | 3 | 4 | 5,
): Promise<ImportResult> {
  const endpoint = `${opt.baseUrl.replace(/\/$/, "")}/api/brands/${opt.brand}/references/import-url`;
  const note = card.advertiser
    ? `TikTok Top #${card.rank + 1} · ${card.advertiser}`
    : `TikTok Top #${card.rank + 1}`;
  const body = {
    image_url: card.imageUrl,
    source_url: card.detailUrl,
    override_title: card.advertiser,
    source_type: "industry" as const,
    source_note: note,
    weight: opt.weight,
    performance_score: performanceScore,
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) return { status: "skip-dup", message: data?.error };
    if (!res.ok) return { status: "error", message: data?.error ?? `HTTP ${res.status}` };
    return { status: "ok", referenceId: data?.reference?.id };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  const opt = parseArgs(process.argv.slice(2));
  console.log(`[scrape] ${opt.listUrl}`);
  console.log(`  limit=${opt.limit}, headless=${opt.headless}, dryRun=${opt.dryRun}`);

  const cards = await scrapeTopAds({
    listUrl: opt.listUrl,
    limit: opt.limit,
    headless: opt.headless,
    cardSelector: opt.cardSelector,
    imageSelector: opt.imageSelector,
    linkSelector: opt.linkSelector,
    advertiserSelector: opt.advertiserSelector,
  });
  console.log(`[scrape] 카드 ${cards.length}개 확보\n`);

  if (opt.dryRun) {
    for (const c of cards) {
      console.log(
        `  #${c.rank + 1} [${c.advertiser ?? "?"}] ${c.detailUrl.slice(0, 80)}`,
      );
      console.log(`      img=${c.imageUrl.slice(0, 80)}`);
    }
    return;
  }

  let okCount = 0;
  let dupCount = 0;
  let errCount = 0;
  const errors: string[] = [];
  const total = cards.length;
  for (const card of cards) {
    const perf = rankToPerformanceScore(card.rank, total);
    const res = await importCard(opt, card, perf);
    const tag =
      res.status === "ok" ? "✓" : res.status === "skip-dup" ? "·" : "✗";
    console.log(
      `  ${tag} #${card.rank + 1} perf=${perf} ${card.advertiser ?? "-"} ${
        res.message ? `(${res.message})` : ""
      }`,
    );
    if (res.status === "ok") okCount++;
    else if (res.status === "skip-dup") dupCount++;
    else {
      errCount++;
      if (res.message) errors.push(`#${card.rank + 1}: ${res.message}`);
    }
  }
  console.log(
    `\n완료: 성공 ${okCount} · 중복 ${dupCount} · 실패 ${errCount} / 총 ${total}`,
  );
  if (errors.length) {
    console.log("실패:");
    for (const e of errors) console.log(`  - ${e}`);
  }
}

main().catch((e) => {
  console.error("치명적 오류:", e);
  process.exit(1);
});
