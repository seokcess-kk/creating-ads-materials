import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";

export const BRAND_ANALYSIS_VERSION = "brand-analyze@2.0.0";
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
          "홈페이지에서 관찰 가능한 주력 Offer 1~3개. 제품/서비스명, 혜택, 가격, 긴박성, 증거 등이 명시되어 있을 때만 추출. 없으면 빈 배열.",
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
          "타겟 고객 페르소나 1~2개. 홈페이지 카피·후기·CTA에서 유추. 확실한 정보만, 추측은 피함.",
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
      notes: { type: "string", description: "관찰 사항·주의점" },
    },
  },
};

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
    // 의미 있는 것만 수집 — viewport, charset 등 잡음 제외
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
      // 비정상 JSON-LD는 원문 그대로 (텍스트 신호로 사용)
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

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AdStudio/1.0; +https://ad-studio.local)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`홈페이지 fetch 실패: HTTP ${res.status}`);
  const html = await res.text();

  const { title, metas, jsonLd, noscript } = extractMetaSignals(html);

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const bodyText = stripTags(body);

  const metaLines: string[] = [];
  if (title) metaLines.push(`Title: ${title}`);
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

  const sections: string[] = [];
  if (metaLines.length > 0) sections.push(`[META]\n${metaLines.join("\n")}`);
  if (jsonLd.length > 0) {
    // JSON-LD는 길 수 있으니 개별 3000자 / 합계 6000자로 자름
    const joined = jsonLd.map((s) => s.slice(0, 3000)).join("\n").slice(0, 6000);
    sections.push(`[JSON-LD]\n${joined}`);
  }
  if (noscript.length > 0) {
    sections.push(`[NOSCRIPT]\n${noscript.join("\n").slice(0, 3000)}`);
  }
  if (bodyText) sections.push(`[BODY]\n${bodyText}`);

  const combined = sections.join("\n\n").slice(0, 16000);
  return combined;
}

export interface AnalyzeWebsiteResult {
  analysis: BrandAnalysis;
  version: string;
  fetchedChars: number;
}

export async function analyzeWebsite(
  url: string,
  usageContext?: import("@/lib/usage/record").UsageContext,
): Promise<AnalyzeWebsiteResult> {
  const text = await fetchPageText(url);

  if (text.trim().length < 80) {
    throw new Error(
      "홈페이지에서 분석 가능한 텍스트를 거의 찾지 못했습니다 (SPA 또는 접근 차단 가능성). Identity 페이지에서 수동 입력을 사용해주세요.",
    );
  }

  const response = await callClaude({
    usageContext,
    model: "opus",
    maxTokens: 5000,
    system: `당신은 한국어 브랜드 분석가입니다. 주어진 웹사이트의 텍스트 신호(META·JSON-LD·NOSCRIPT·BODY 섹션)에서 브랜드의 category, description, voice, taboos, colors, offers, audiences를 추출합니다.

입력 포맷 안내:
- [META]: <title>, meta description/keywords, og:*, twitter:* 등 — 가장 압축된 브랜드 메시지. 우선순위 최상.
- [JSON-LD]: schema.org 구조화 데이터 (Organization·Product·Service·LocalBusiness 등) — 공식 정보.
- [NOSCRIPT]: JS 없이 노출되는 SSR fallback 텍스트.
- [BODY]: 나머지 본문. SPA 사이트는 이 부분이 얇을 수 있음.

규칙:
- 관찰 가능한 정보 위주로 보수적으로 채우고, 불확실한 필드는 생략.
- SPA라 BODY가 짧아도, META·JSON-LD·keywords만으로 category/description/voice는 반드시 추출 시도.
- voice.tone은 한 줄, 나머지는 3~5개 태그.
- colors는 홈페이지 CTA·헤더 등에 명확히 쓰인 경우에만 (HTML/CSS에서 식별 가능한 HEX만). META·BODY 어디에도 HEX가 없으면 빈 배열.
- description은 1~2문장, 광고 카피가 아닌 브랜드 소개 톤. META description이 있으면 이를 다듬어 사용.
- offers: 홈페이지에서 제품·서비스명/가격/혜택/긴박성이 명시된 것만. 최대 3개. 없으면 빈 배열. 가장 주력 Offer를 1번째로.
- audiences: 타겟 페르소나 1~2개. 후기·CTA 문구·해결하려는 문제로부터 유추 가능한 구체적 인물상. "모든 사람" 같은 추상적 표현 금지. pains·desires는 홈페이지 카피에서 직접 찾은 것만.
- 모든 출력은 한국어.
- 도구 ${ANALYSIS_TOOL} 호출로만 결과 기록.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `URL: ${url}

페이지 신호 (섹션별로 구분되어 있음):
${text}

위 내용으로 브랜드 정보를 추출하여 ${ANALYSIS_TOOL} 도구로 기록하세요.`,
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
    fetchedChars: text.length,
  };
}
