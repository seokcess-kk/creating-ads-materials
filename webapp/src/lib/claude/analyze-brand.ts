import { getClaudeClient } from "./client";

const BRAND_ANALYSIS_PROMPT = `이 브랜드 에셋(로고, 기존 소재, 웹사이트 스크린샷 등)을 분석하여 브랜드 스타일 가이드를 JSON으로 출력해줘:

{
  "brand_colors": {
    "primary": "메인 컬러 HEX",
    "secondary": "서브 컬러 HEX",
    "accent": "액센트 컬러 HEX",
    "background": "배경 컬러 HEX",
    "text": "텍스트 컬러 HEX"
  },
  "typography_style": {
    "headline": "헤드라인 폰트 스타일 추정",
    "body": "본문 폰트 스타일 추정",
    "overall_feel": "타이포그래피 전체 느낌"
  },
  "visual_style": {
    "photography_style": "사진 스타일 (밝기, 톤, 필터)",
    "illustration_style": "일러스트 스타일 (있을 경우)",
    "icon_style": "아이콘 스타일 (있을 경우)"
  },
  "brand_personality": ["브랜드 성격 키워드들"],
  "tone_of_voice": "커뮤니케이션 톤",
  "do": ["이 브랜드에 어울리는 디자인 요소"],
  "dont": ["이 브랜드에 어울리지 않는 디자인 요소"],
  "recommended_ad_style": "광고 제작 시 추천 스타일"
}

JSON만 출력하고 다른 텍스트는 포함하지 마.`;

export async function analyzeBrandAssets(
  imageUrls: string[],
  websiteUrl?: string
): Promise<Record<string, unknown>> {
  const claude = getClaudeClient();

  const content: Anthropic.Messages.ContentBlockParam[] = [];

  // 이미지 에셋 추가
  for (const url of imageUrls) {
    try {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mediaType = res.headers.get("content-type") || "image/png";

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: base64,
        },
      });
    } catch {
      console.warn(`이미지 로드 실패: ${url}`);
    }
  }

  // 웹사이트 정보 추가
  if (websiteUrl) {
    content.push({
      type: "text",
      text: `브랜드 웹사이트: ${websiteUrl}`,
    });
  }

  content.push({ type: "text", text: BRAND_ANALYSIS_PROMPT });

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content }],
  });

  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // JSON 파싱
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { raw: text };
}

// Anthropic 타입 import를 위해
import type Anthropic from "@anthropic-ai/sdk";
