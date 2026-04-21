import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";

export const BRAND_ANALYSIS_VERSION = "brand-analyze@3.0.0";
export const ANALYSIS_TOOL = "record_brand_analysis";

export const BrandAnalysisSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  voice: z
    .object({
      tone: z.string().optional(),
      personality: z.array(z.string()).optional(),
      do: z.array(z.string()).optional(),
      dont: z.array(z.string()).optional(),
    })
    .optional(),
  taboos: z.array(z.string()).optional(),
  colors: z
    .array(
      z.object({
        role: z.enum(["primary", "secondary", "accent", "neutral", "semantic"]),
        hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        usage: z.string().optional(),
      }),
    )
    .optional(),
  offers: z
    .array(
      z.object({
        title: z.string().min(1),
        usp: z.string().optional(),
        price: z.string().optional(),
        benefits: z.array(z.string()).optional(),
        urgency: z.string().optional(),
        evidence: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  audiences: z
    .array(
      z.object({
        persona_name: z.string().min(1),
        pains: z.array(z.string()).optional(),
        desires: z.array(z.string()).optional(),
        demographics: z.record(z.string(), z.unknown()).optional(),
        language_level: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});
export type BrandAnalysis = z.infer<typeof BrandAnalysisSchema>;

export const analysisTool: Tool = {
  name: ANALYSIS_TOOL,
  description: "웹사이트 내용에서 브랜드 정보 추출",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "주 업종 slug (education, ecommerce, saas, fnb, beauty, fitness 등)",
      },
      description: { type: "string", description: "브랜드 1~2줄 설명" },
      voice: {
        type: "object",
        properties: {
          tone: { type: "string", description: "브랜드 톤 한 줄 (예: 신뢰감 있고 전문적인)" },
          personality: {
            type: "array",
            items: { type: "string" },
            description: "브랜드 성격 태그 3~5개",
          },
          do: {
            type: "array",
            items: { type: "string" },
            description: "권장 표현·태도",
          },
          dont: {
            type: "array",
            items: { type: "string" },
            description: "회피할 표현·태도",
          },
        },
      },
      taboos: {
        type: "array",
        items: { type: "string" },
        description: "브랜드가 피해야 할 표현 단어들",
      },
      colors: {
        type: "array",
        description: "홈페이지에서 관찰 가능한 브랜드 컬러 (확실한 것만)",
        items: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["primary", "secondary", "accent", "neutral", "semantic"],
            },
            hex: { type: "string", description: "#RRGGBB" },
            usage: { type: "string" },
          },
          required: ["role", "hex"],
        },
      },
      offers: {
        type: "array",
        description:
          "사이트에서 관찰 가능한 주력 Offer 1~3개. 제품/서비스명, 혜택, 가격, 긴박성, 증거 등이 명시되어 있을 때만 추출. 없으면 빈 배열.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "제품·서비스 이름 (예: 'STUDYCORE 프리미엄 플랜')",
            },
            usp: {
              type: "string",
              description:
                "고유 가치 제안 한 줄 (예: '하루 15분으로 영어 실력 2배')",
            },
            price: {
              type: "string",
              description: "가격·요금제 표기 (예: '월 19,900원', '연 99,000원')",
            },
            benefits: {
              type: "array",
              items: { type: "string" },
              description: "구체적 혜택 3~5개",
            },
            urgency: {
              type: "string",
              description: "긴박성·한정성 (예: '선착순 100명', '2월 말까지')",
            },
            evidence: {
              type: "array",
              items: { type: "string" },
              description:
                "신뢰 증거 (예: '10만 명 수강', '전문가 추천', '인증서')",
            },
          },
          required: ["title"],
        },
      },
      audiences: {
        type: "array",
        description:
          "타겟 고객 페르소나 1~2개. 후기·CTA 문구·지역·업종으로부터 유추 가능한 구체적 인물상.",
        items: {
          type: "object",
          properties: {
            persona_name: {
              type: "string",
              description:
                "페르소나 이름 (예: '취업 준비 중인 직장인 3년차')",
            },
            pains: {
              type: "array",
              items: { type: "string" },
              description: "이 페르소나가 겪는 고민·문제점 3~5개",
            },
            desires: {
              type: "array",
              items: { type: "string" },
              description: "원하는 결과·상태 3~5개",
            },
            demographics: {
              type: "object",
              description:
                "인구통계 정보 (예: { age: '25-34', gender: '여성', occupation: '직장인' })",
            },
            language_level: {
              type: "string",
              description:
                "언어 수준·친숙도 (예: '일상 대화 수준', '전문 용어 익숙')",
            },
          },
          required: ["persona_name"],
        },
      },
      notes: { type: "string", description: "관찰 사항·추정 근거" },
    },
  },
};

// ── 공통 유틸 ────────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (compatible; AdStudio/1.0; +https://ad-studio.local)";
const PAGE_FETCH_TIMEOUT_MS = 8000;
const SITEMAP_FETCH_TIMEOUT_MS = 6000;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// ── 메타·본문 추출 ───────────────────────────────────────────────────────────

function extractMetaSignals(html: string): {
  title: string;
  metas: Record<string, string>;
  jsonLd: string[];
  noscript: string[];
} {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [
    "",
    "",
  ])[1];

  const metas: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key =
      (tag.match(/\b(?:name|property|itemprop)\s*=\s*["']([^"']+)["']/i) ?? [
        "",
        "",
      ])[1];
    const content = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) ?? [
      "",
      "",
    ])[1];
    if (!key || !content) continue;
    const k = key.toLowerCase();
    if (
      k === "description" ||
      k === "keywords" ||
      k === "author" ||
      k.startsWith("og:") ||
      k.startsWith("twitter:") ||
      k === "application-name" ||
      k === "apple-mobile-web-app-title"
    ) {
      metas[k] = decodeEntities(content).trim();
    }
  }

  const jsonLd: string[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      jsonLd.push(JSON.stringify(parsed));
    } catch {
      jsonLd.push(raw.slice(0, 4000));
    }
  }

  const noscript: string[] = [];
  for (const m of html.matchAll(/<noscript[^>]*>([\s\S]*?)<\/noscript>/gi)) {
    const stripped = stripTags(m[1]);
    if (stripped.length > 0) noscript.push(stripped);
  }

  return {
    title: decodeEntities(title).trim(),
    metas,
    jsonLd,
    noscript,
  };
}

function extractBodyText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return stripTags(body);
}

interface PageSections {
  url: string;
  pathLabel: string;
  title: string;
  metaLines: string[];
  jsonLd: string[];
  noscript: string[];
  bodyText: string;
}

function buildPageSections(url: string, html: string): PageSections {
  const { title, metas, jsonLd, noscript } = extractMetaSignals(html);
  const metaLines: string[] = [];
  const metaOrder = [
    "description",
    "og:title",
    "og:description",
    "og:site_name",
    "twitter:title",
    "twitter:description",
    "keywords",
    "author",
    "application-name",
    "apple-mobile-web-app-title",
  ];
  for (const k of metaOrder) {
    const v = metas[k];
    if (v) metaLines.push(`${k}: ${v}`);
  }
  let pathLabel = "/";
  try {
    const u = new URL(url);
    pathLabel = u.pathname || "/";
  } catch {}
  return {
    url,
    pathLabel,
    title,
    metaLines,
    jsonLd,
    noscript,
    bodyText: extractBodyText(html),
  };
}

function renderPageSection(p: PageSections, bodyLimit: number): string {
  const parts: string[] = [];
  parts.push(`=== PAGE: ${p.pathLabel} (${p.url}) ===`);
  if (p.title) parts.push(`Title: ${p.title}`);
  if (p.metaLines.length > 0) parts.push(`[META]\n${p.metaLines.join("\n")}`);
  if (p.jsonLd.length > 0) {
    const joined = p.jsonLd.map((s) => s.slice(0, 2500)).join("\n").slice(0, 5000);
    parts.push(`[JSON-LD]\n${joined}`);
  }
  if (p.noscript.length > 0) {
    parts.push(`[NOSCRIPT]\n${p.noscript.join("\n").slice(0, 2000)}`);
  }
  if (p.bodyText) parts.push(`[BODY]\n${p.bodyText.slice(0, bodyLimit)}`);
  return parts.join("\n\n");
}

// ── 후보 URL 수집 ────────────────────────────────────────────────────────────

function sameOrigin(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.host === b.host;
}

function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeEntities(m[1]).trim();
    if (!href) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (!sameOrigin(abs, baseUrl)) continue;
      abs.hash = "";
      // 확장자 필터: 이미지·파일 제외
      if (/\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|mp4|mov|webm|css|js|json|xml)$/i.test(abs.pathname)) continue;
      found.add(abs.toString());
    } catch {}
  }
  return Array.from(found);
}

async function fetchSitemapUrls(baseUrl: URL): Promise<string[]> {
  const candidates = [
    new URL("/sitemap.xml", baseUrl).toString(),
    new URL("/sitemap_index.xml", baseUrl).toString(),
  ];
  for (const sm of candidates) {
    try {
      const res = await fetch(sm, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const urls: string[] = [];
      for (const m of xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)) {
        const u = decodeEntities(m[1]).trim();
        if (!u) continue;
        try {
          const abs = new URL(u);
          if (sameOrigin(abs, baseUrl)) {
            abs.hash = "";
            urls.push(abs.toString());
          }
        } catch {}
      }
      if (urls.length > 0) return urls;
    } catch {
      // 다음 후보
    }
  }
  return [];
}

const KEYWORD_GROUPS: Array<{ priority: number; keywords: RegExp }> = [
  // 가격·요금 — 최우선 (Offer 추출에 직결)
  { priority: 1, keywords: /(pricing|price|plan|cost|fee|요금|가격|이용료|이용권|회원권)/i },
  // 이벤트·프로모션·전시
  {
    priority: 2,
    keywords:
      /(event|promotion|promo|sale|discount|coupon|campaign|exhibition|이벤트|프로모션|할인|쿠폰|혜택|전시|특가)/i,
  },
  // 제품·서비스·메뉴·시술
  {
    priority: 3,
    keywords:
      /(service|product|treatment|menu|course|catalog|collection|시술|메뉴|서비스|프로그램|상품|제품|컬렉션)/i,
  },
  // 소개·회사·브랜드·스태프
  {
    priority: 4,
    keywords:
      /(about|company|brand|branding|story|team|staff|doctor|introduce|소개|브랜드|회사|우리|의료진|의사|원장)/i,
  },
  // 후기·리뷰·사례·포트폴리오 (페르소나 추출 보강)
  {
    priority: 5,
    keywords:
      /(review|testimonial|case|portfolio|gallery|before-?after|후기|리뷰|사례|체험|갤러리|포트폴리오)/i,
  },
  // 일정·예약·상담 (운영 정보 → Audience 간접 신호)
  {
    priority: 6,
    keywords:
      /(schedule|booking|reservation|consult|contact|location|notice|news|faq|일정|예약|상담|공지|문의)/i,
  },
];

interface RankedCandidate {
  url: string;
  priority: number; // 낮을수록 우선
  pathDepth: number; // 낮을수록 상위
}

const UNRANKED_FALLBACK_PRIORITY = 90; // 키워드 매치 없음 — 얕은 depth일 때만 후순위로
const EXCLUDE_PATH =
  /(terms|policy|privacy|login|logout|signin|signup|register|cart|checkout|robots|sitemap|약관|개인정보|로그인|회원가입)/i;

function rankCandidates(urls: string[], baseUrl: URL): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  const rootStr = new URL("/", baseUrl).toString();
  for (const url of urls) {
    try {
      const u = new URL(url);
      if (u.toString() === rootStr) continue;
      if (u.pathname === "/" || u.pathname === "") continue;

      const path = u.pathname.toLowerCase();
      if (EXCLUDE_PATH.test(path)) continue;

      const depth = path.split("/").filter(Boolean).length;

      let priority = UNRANKED_FALLBACK_PRIORITY;
      for (const g of KEYWORD_GROUPS) {
        if (g.keywords.test(path)) {
          priority = Math.min(priority, g.priority);
        }
      }
      // fallback 후보는 depth가 너무 깊으면(>2) 제외 — 디테일 페이지·상세글일 확률 큼
      if (priority === UNRANKED_FALLBACK_PRIORITY && depth > 2) continue;

      ranked.push({ url: u.toString(), priority, pathDepth: depth });
    } catch {}
  }
  ranked.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.pathDepth !== b.pathDepth) return a.pathDepth - b.pathDepth;
    return a.url.localeCompare(b.url);
  });
  const seen = new Set<string>();
  const out: RankedCandidate[] = [];
  for (const r of ranked) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
}

// ── 크롤링 메인 ──────────────────────────────────────────────────────────────

const MAX_EXTRA_PAGES = 4; // 홈 + 4 = 총 5 페이지

async function crawlSite(rootUrlStr: string): Promise<{
  pages: PageSections[];
  fetchedChars: number;
  errors: Array<{ url: string; reason: string }>;
}> {
  const baseUrl = new URL(rootUrlStr);
  const errors: Array<{ url: string; reason: string }> = [];

  // 1. 홈 fetch
  let homeHtml: string;
  try {
    homeHtml = await fetchHtml(baseUrl.toString(), PAGE_FETCH_TIMEOUT_MS);
  } catch (e) {
    throw new Error(
      `홈페이지 fetch 실패: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const homeSections = buildPageSections(baseUrl.toString(), homeHtml);

  // 2. sitemap + 내부링크 병합 → 후보 수집
  const [sitemapUrls, homeLinks] = await Promise.all([
    fetchSitemapUrls(baseUrl).catch(() => [] as string[]),
    Promise.resolve(extractInternalLinks(homeHtml, baseUrl)),
  ]);
  const allUrls = Array.from(new Set([...sitemapUrls, ...homeLinks]));
  const ranked = rankCandidates(allUrls, baseUrl);

  // 3. 우선순위 그룹별로 최대 MAX_EXTRA_PAGES 개 선택, 한 priority당 최대 2개
  const selected: string[] = [];
  const perPriorityCap = 2;
  const perPriorityCount = new Map<number, number>();
  for (const r of ranked) {
    if (selected.length >= MAX_EXTRA_PAGES) break;
    const cnt = perPriorityCount.get(r.priority) ?? 0;
    if (cnt >= perPriorityCap) continue;
    selected.push(r.url);
    perPriorityCount.set(r.priority, cnt + 1);
  }

  // 4. 병렬 fetch + sections
  const extraSections = await Promise.all(
    selected.map(async (url) => {
      try {
        const html = await fetchHtml(url, PAGE_FETCH_TIMEOUT_MS);
        return buildPageSections(url, html);
      } catch (e) {
        errors.push({
          url,
          reason: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    }),
  );

  const pages: PageSections[] = [homeSections];
  for (const s of extraSections) {
    if (s) pages.push(s);
  }

  const fetchedChars = pages.reduce(
    (sum, p) => sum + p.bodyText.length + p.metaLines.join("").length,
    0,
  );

  return { pages, fetchedChars, errors };
}

function renderCrawlText(pages: PageSections[]): string {
  // 전체 상한 32000자, 페이지당 BODY 상한은 페이지 수에 따라 가변
  const perPageBodyLimit =
    pages.length <= 2 ? 6000 : pages.length <= 4 ? 4000 : 2800;
  const rendered = pages.map((p) => renderPageSection(p, perPageBodyLimit));
  return rendered.join("\n\n").slice(0, 32000);
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

export interface AnalyzeWebsiteResult {
  analysis: BrandAnalysis;
  version: string;
  fetchedChars: number;
  pagesCrawled: number;
  pagesAttempted: number;
  errors?: Array<{ url: string; reason: string }>;
}

export async function analyzeWebsite(
  url: string,
  usageContext?: import("@/lib/usage/record").UsageContext,
): Promise<AnalyzeWebsiteResult> {
  const crawl = await crawlSite(url);
  const combinedText = renderCrawlText(crawl.pages);

  if (combinedText.trim().length < 80) {
    throw new Error(
      "홈페이지에서 분석 가능한 텍스트를 거의 찾지 못했습니다 (SPA 또는 접근 차단 가능성). Identity 페이지에서 수동 입력을 사용해주세요.",
    );
  }

  const response = await callClaude({
    usageContext,
    model: "opus",
    maxTokens: 5000,
    system: `당신은 한국어 브랜드 분석가입니다. 주어진 **여러 페이지의 텍스트 신호**에서 브랜드 정보를 추출합니다. 각 페이지는 \`=== PAGE: /path (url) ===\` 헤더로 구분되며, 섹션은 [META] / [JSON-LD] / [NOSCRIPT] / [BODY] 중 일부가 포함됩니다.

섹션 해석:
- [META]: <title>, description, og:*, twitter:*, keywords — 브랜드 메시지의 압축본. 신뢰도 최상.
- [JSON-LD]: schema.org 구조화 데이터 — 공식 정보 (Organization·Product·Service·LocalBusiness·Offer).
- [NOSCRIPT]: JS 없이 노출되는 SSR fallback.
- [BODY]: 본문. SPA는 홈이 얇고, 하위 페이지는 종종 서버 렌더되어 더 풍부함.

페이지별 힌트:
- \`/pricing\`·\`/price\`·\`/plan\`·가격 관련 경로 → offers 추출 핵심 소스.
- \`/event\`·\`/promotion\` → urgency·할인 정보.
- \`/service\`·\`/menu\`·\`/treatment\`·\`/product\` → offer 타이틀·benefits.
- \`/about\` → voice·description·회사 규모.
- \`/review\`·\`/testimonial\` → audiences의 pains·desires.

출력 원칙 — **가능한 정보 최대한 채우기 (추정 초안 허용)**:
- 빈 필드보다 **관찰 신호 기반의 불완전한 초안이 낫다**. 사용자가 이후 수정할 수 있음.
- 확신이 낮으면 값은 채우되 \`notes\`에 "추정 근거" 1~2줄 기록.
- \`category\`: 반드시 추출. META·keywords·업종 관련 용어로 판단.
- \`description\`: 반드시 1~2문장 작성. META description이 있으면 그대로 다듬어 사용.
- \`voice.tone\`: 반드시 한 줄 작성 (예: "전문적이고 신뢰감 있는"). 업종·톤 용어에서 추정 허용.
- \`voice.personality\`: 최소 3개 태그. 업종 특성에서 추정 허용.
- \`voice.do\` / \`voice.dont\`: 관찰 가능할 때만. 없으면 생략 가능.
- \`taboos\`: 업종별로 흔히 회피하는 표현이 있다면 2~3개 기록 가능. 확신 없으면 빈 배열.
- \`colors\`: HEX(#RRGGBB)가 META·BODY·JSON-LD 어디에도 명시되지 않았다면 **빈 배열**. 추측 금지 (정확도가 가장 중요한 필드).
- \`offers\`: pricing/event/service 페이지에서 관찰 가능한 것만. 최대 3개. 없으면 빈 배열. 가격·혜택·urgency는 페이지에서 직접 인용.
- \`audiences\`: **최소 1개 페르소나 필수**. category + description + 지역·키워드에서 유추 허용. persona_name은 구체적으로 (예: "강남 거주 30대 직장인 여성, 자연스러운 피부 관리 선호"). "모든 사람" 금지. pains·desires는 업종 일반 통념으로 추정 가능하되 홈페이지 신호가 있으면 인용.
- 모든 출력은 한국어.
- 도구 ${ANALYSIS_TOOL} 호출로만 결과 기록.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `루트 URL: ${url}
수집된 페이지 수: ${crawl.pages.length}

페이지별 신호:

${combinedText}

위 내용에서 category/description/voice/taboos/colors/offers/audiences를 추출하여 ${ANALYSIS_TOOL} 도구로 기록하세요. 빈 필드보다는 관찰 신호 기반 초안을 우선합니다.`,
          },
        ],
      },
    ],
    tools: [analysisTool],
    toolChoice: { type: "tool", name: ANALYSIS_TOOL },
  });

  const raw = extractToolUse(response, ANALYSIS_TOOL);
  if (!raw) throw new Error("분석 결과를 추출할 수 없습니다");

  const parsed = BrandAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`분석 스키마 검증 실패: ${parsed.error.message}`);
  }

  return {
    analysis: parsed.data,
    version: BRAND_ANALYSIS_VERSION,
    fetchedChars: combinedText.length,
    pagesCrawled: crawl.pages.length,
    pagesAttempted: crawl.pages.length + crawl.errors.length,
    errors: crawl.errors.length > 0 ? crawl.errors : undefined,
  };
}
