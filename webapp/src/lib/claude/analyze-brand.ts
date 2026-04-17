import { getClaudeClient } from "./client";

const BRAND_ANALYSIS_PROMPT = `이 브랜드의 에셋(로고, 웹사이트 등)을 분석하여 광고 소재 제작에 필요한 모든 정보를 JSON으로 출력해줘.
비주얼 스타일뿐 아니라 콘텐츠(소구 포인트, 서비스, 타겟)까지 포함해야 한다.

{
  "industry": "업종 분류 (예: 교육/관리형학습, 의료/피부과, 이커머스/패션 등)",
  "service_summary": "이 브랜드가 제공하는 핵심 서비스/제품 한줄 요약",
  "key_services": ["제공하는 주요 서비스/기능 목록"],
  "usp": ["다른 브랜드와 차별화되는 핵심 강점 (Unique Selling Proposition)"],
  "selling_points": ["웹사이트에서 강조하는 소구 포인트들"],
  "slogan": "메인 슬로건 또는 핵심 카피 (있을 경우)",
  "target_audience": {
    "primary": "주요 타겟 고객층",
    "demographics": "인구통계 (나이, 성별 등)",
    "pain_points": ["타겟이 겪는 문제/고민"]
  },
  "cta_patterns": ["웹사이트에서 사용하는 CTA 문구들 (예: 상담 신청, 무료 체험 등)"],
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
    "key_visual_type": "이 업종에 필요한 핵심 비주얼 유형 (product|space|person|screenshot)"
  },
  "brand_personality": ["브랜드 성격 키워드들"],
  "tone_of_voice": "커뮤니케이션 톤",
  "do": ["이 브랜드 광고에 어울리는 요소"],
  "dont": ["이 브랜드 광고에 어울리지 않는 요소"],
  "recommended_ad_style": "광고 제작 시 추천 스타일",
  "recommended_ad_angles": ["효과적일 것으로 예상되는 광고 앵글/접근법 (예: 사회적 증거, 혜택 강조, 문제 해결 등)"]
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

  // 웹사이트 콘텐츠 크롤링 후 전달
  if (websiteUrl) {
    try {
      const siteRes = await fetch(websiteUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AdStudioBot/1.0)" },
      });
      const html = await siteRes.text();

      // HTML에서 텍스트 추출 (태그 제거, 스크립트/스타일 제거)
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000); // Claude 컨텍스트 절약

      content.push({
        type: "text",
        text: `=== 브랜드 웹사이트 콘텐츠 (${websiteUrl}) ===\n${textContent}`,
      });
    } catch {
      console.warn(`웹사이트 크롤링 실패: ${websiteUrl}`);
      content.push({
        type: "text",
        text: `브랜드 웹사이트 URL: ${websiteUrl} (접근 실패, URL만 참고)`,
      });
    }
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
