import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient } from "./client";

const BP_ANALYSIS_PROMPT = `이 광고 소재 이미지를 전문 광고 디자이너 관점에서 분석하여 JSON으로 출력해줘:

{
  "color_palette": ["사용된 주요 색상 HEX 코드들"],
  "layout": {
    "structure": "레이아웃 구조 설명",
    "text_position": "텍스트 배치",
    "cta_position": "CTA 위치"
  },
  "mood": ["분위기/톤 키워드들"],
  "text_content": {
    "headline": "헤드라인 텍스트",
    "sub_copy": "서브 카피",
    "cta": "CTA 텍스트"
  },
  "ad_style": "광고 스타일 분류",
  "strengths": ["강점 목록"],
  "weaknesses": ["약점 목록"],
  "reusable_patterns": ["다른 소재에 재활용 가능한 디자인 패턴"]
}

JSON만 출력하세요.`;

export async function analyzeBP(imageUrl: string): Promise<Record<string, unknown>> {
  const claude = getClaudeClient();

  const res = await fetch(imageUrl);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = res.headers.get("content-type") || "image/png";

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
            data: base64,
          },
        },
        { type: "text", text: BP_ANALYSIS_PROMPT },
      ],
    }],
  });

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
}
