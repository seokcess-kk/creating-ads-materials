import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { callClaude, extractToolUse } from "@/lib/engines/claude";

export const BRAND_ANALYSIS_VERSION = "brand-analyze@1.0.0";
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
      notes: { type: "string", description: "관찰 사항·주의점" },
    },
  },
};

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

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 12000);
}

export interface AnalyzeWebsiteResult {
  analysis: BrandAnalysis;
  version: string;
  fetchedChars: number;
}

export async function analyzeWebsite(url: string): Promise<AnalyzeWebsiteResult> {
  const text = await fetchPageText(url);

  const response = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: `당신은 한국어 브랜드 분석가입니다. 주어진 웹사이트의 본문 텍스트에서 브랜드의 category, description, voice(tone/personality/do/dont), taboos, colors를 추출합니다.

규칙:
- 관찰 가능한 정보 위주로 보수적으로 채우고, 불확실한 필드는 생략.
- voice.tone은 한 줄, 나머지는 3~5개 태그.
- colors는 홈페이지 CTA·헤더 등에 명확히 쓰인 경우에만 (HTML/CSS에서 식별 가능한 HEX만).
- description은 1~2문장, 광고 카피가 아닌 브랜드 소개 톤.
- 모든 출력은 한국어.
- 도구 ${ANALYSIS_TOOL} 호출로만 결과 기록.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `URL: ${url}

페이지 본문:
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
