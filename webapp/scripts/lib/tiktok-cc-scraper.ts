import { chromium, type Browser, type Page } from "playwright";

export interface ScrapedAdCard {
  detailUrl: string;
  imageUrl: string;
  advertiser: string | null;
  rank: number; // 0-based, 페이지에 노출된 순서
}

export interface ScrapeOptions {
  listUrl: string;
  limit?: number;
  timeoutMs?: number;
  headless?: boolean;
  // 레이아웃이 바뀌면 셀렉터만 CLI에서 덮어쓸 수 있게.
  cardSelector?: string;
  imageSelector?: string;
  linkSelector?: string;
  advertiserSelector?: string;
}

const DEFAULT_OPTIONS = {
  limit: 30,
  timeoutMs: 45000,
  headless: true,
  cardSelector:
    'a[href*="/inspiration/detail/"], a[href*="/topads/detail/"], div[data-testid*="card"]',
  imageSelector: "img",
  linkSelector: 'a[href*="/inspiration/detail/"], a[href*="/topads/detail/"], a[href]',
  advertiserSelector:
    '[class*="brand"], [class*="advertiser"], [data-testid*="advertiser"]',
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function autoScroll(page: Page, targetCount: number, cardSel: string): Promise<void> {
  const maxIterations = 20;
  let stableFor = 0;
  let lastCount = 0;
  for (let i = 0; i < maxIterations; i++) {
    const count = await page.locator(cardSel).count();
    if (count >= targetCount) return;
    if (count === lastCount) {
      stableFor += 1;
      if (stableFor >= 3) return;
    } else {
      stableFor = 0;
    }
    lastCount = count;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
  }
}

function absoluteUrl(maybe: string | null, base: string): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

/**
 * TikTok Creative Center의 Top Ads 리스트 페이지를 렌더링해 카드 목록을 긁는다.
 * DOM 구조가 자주 바뀌므로 셀렉터는 CLI에서 override 가능.
 * 이미지 URL은 lazy-load 대응(src/data-src/srcset 순).
 */
export async function scrapeTopAds(options: ScrapeOptions): Promise<ScrapedAdCard[]> {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const browser: Browser = await chromium.launch({ headless: opt.headless });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1440, height: 900 },
      locale: "ko-KR",
    });
    const page = await context.newPage();
    await page.goto(opt.listUrl, { waitUntil: "domcontentloaded", timeout: opt.timeoutMs });
    // 카드 셀렉터가 아예 없으면 로딩 실패 or 레이아웃 변경.
    await page
      .waitForSelector(opt.cardSelector, { timeout: opt.timeoutMs })
      .catch(() => {
        throw new Error(
          `카드 셀렉터(${opt.cardSelector})가 등장하지 않음 — 레이아웃 변경 가능성. --card-selector로 덮어쓰세요.`,
        );
      });
    await autoScroll(page, opt.limit, opt.cardSelector);

    const results = await page.evaluate(
      ({ cardSel, imgSel, linkSel, advSel, limit, pageUrl }) => {
        const out: Array<{
          detailUrl: string | null;
          imageUrl: string | null;
          advertiser: string | null;
        }> = [];
        const cards = Array.from(
          document.querySelectorAll(cardSel),
        ).slice(0, limit * 2);
        for (const card of cards) {
          const img = (card as HTMLElement).querySelector(imgSel) as
            | HTMLImageElement
            | null;
          const imageUrl =
            img?.getAttribute("src") ??
            img?.getAttribute("data-src") ??
            img?.getAttribute("data-original") ??
            (img?.getAttribute("srcset")?.split(",")[0]?.trim().split(" ")[0] ??
              null);
          const link = ((card as HTMLElement).tagName === "A"
            ? (card as HTMLAnchorElement)
            : ((card as HTMLElement).querySelector(linkSel) as
                | HTMLAnchorElement
                | null)) as HTMLAnchorElement | null;
          const detailUrl = link?.getAttribute("href") ?? null;
          const adv = (card as HTMLElement).querySelector(advSel);
          const advertiser = adv?.textContent?.trim() ?? null;
          out.push({ detailUrl, imageUrl, advertiser });
          if (out.length >= limit) break;
        }
        return { cards: out, pageUrl };
      },
      {
        cardSel: opt.cardSelector,
        imgSel: opt.imageSelector,
        linkSel: opt.linkSelector,
        advSel: opt.advertiserSelector,
        limit: opt.limit,
        pageUrl: opt.listUrl,
      },
    );

    const scraped: ScrapedAdCard[] = [];
    for (let i = 0; i < results.cards.length; i++) {
      const r = results.cards[i];
      const detail = absoluteUrl(r.detailUrl, results.pageUrl);
      const img = absoluteUrl(r.imageUrl, results.pageUrl);
      if (!detail || !img) continue;
      scraped.push({
        detailUrl: detail,
        imageUrl: img,
        advertiser: r.advertiser,
        rank: scraped.length,
      });
      if (scraped.length >= opt.limit) break;
    }
    return scraped;
  } finally {
    await browser.close();
  }
}
