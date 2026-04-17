import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient } from "./client";

const LOGO_ANALYSIS_PROMPT = `업로드된 로고 이미지들을 분석하여 각 로고의 특성을 JSON 배열로 출력해줘.

각 로고에 대해:
{
  "index": 0,
  "variant": "full | icon | horizontal | vertical | wordmark",
  "theme": "light | dark | both",
  "has_transparency": true/false,
  "dominant_color": "로고의 주요 색상 (예: white, black, navy, multi-color)",
  "suitable_for": {
    "dark_background": true/false,
    "light_background": true/false
  },
  "has_text": true/false,
  "quality_score": 1~5,
  "description": "로고 설명 한줄"
}

- theme: 로고 색상이 밝으면 "dark" (어두운 배경에 적합), 어두우면 "light" (밝은 배경에 적합), 둘 다 가능하면 "both"
- variant: 브랜드명+심볼 전체면 "full", 심볼만이면 "icon", 텍스트만이면 "wordmark", 가로로 길면 "horizontal", 세로로 길면 "vertical"
- quality_score: 해상도, 선명도, 전문성 기준 1~5점

JSON 배열만 출력하고 다른 텍스트는 포함하지 마.`;

export interface LogoAnalysis {
  index: number;
  variant: string;
  theme: string;
  has_transparency: boolean;
  dominant_color: string;
  suitable_for: {
    dark_background: boolean;
    light_background: boolean;
  };
  has_text: boolean;
  quality_score: number;
  description: string;
}

export async function analyzeLogos(imageUrls: string[]): Promise<LogoAnalysis[]> {
  const claude = getClaudeClient();

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  for (const url of imageUrls) {
    try {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const contentType = res.headers.get("content-type") || "image/png";

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: contentType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: base64,
        },
      });
    } catch {
      console.warn(`로고 이미지 로드 실패: ${url}`);
    }
  }

  content.push({ type: "text", text: LOGO_ANALYSIS_PROMPT });

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  });

  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return [];
}
