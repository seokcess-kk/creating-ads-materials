import { getClaudeClient } from "./client";
import { getBrand } from "@/lib/db/brands";
import { getCampaign } from "@/lib/db/campaigns";

export async function generateBrief(campaignId: string, sellingPoint: string, campaignGoal: string, additionalInfo?: string) {
  const claude = getClaudeClient();
  const campaign = await getCampaign(campaignId);
  const brand = await getBrand(campaign.brand_id);

  const styleGuide = brand.style_guide_json || {};

  const prompt = `당신은 광고 크리에이티브 디렉터입니다. 아래 정보를 기반으로 크리에이티브 브리프를 JSON으로 작성하세요.

브랜드 정보:
- 브랜드명: ${brand.name}
- 웹사이트: ${brand.website_url || "없음"}
- 업종: ${styleGuide.industry || "미분류"}
- USP: ${JSON.stringify(styleGuide.usp || [])}
- 소구포인트: ${JSON.stringify(styleGuide.selling_points || [])}
- 슬로건: ${styleGuide.slogan || "없음"}
- 타겟: ${JSON.stringify(styleGuide.target_audience || {})}
- 브랜드 성격: ${JSON.stringify(styleGuide.brand_personality || [])}
- 톤: ${styleGuide.tone_of_voice || "미정"}
- 추천 광고 앵글: ${JSON.stringify(styleGuide.recommended_ad_angles || [])}

캠페인 정보:
- 소구포인트: ${sellingPoint}
- 캠페인 목표: ${campaignGoal}
- 채널: ${JSON.stringify(campaign.target_channels)}
- 추가 정보: ${additionalInfo || "없음"}

JSON 출력:
{
  "campaign_concept": "캠페인 핵심 콘셉트 한줄",
  "tone_and_manner": "이 캠페인의 톤앤매너",
  "target_persona": {
    "primary": "주요 타겟",
    "pain_point": "타겟의 고민",
    "motivation": "행동 동기"
  },
  "key_message": "핵심 메시지",
  "channel_strategy": [
    {
      "channel": "채널ID",
      "message_direction": "이 채널에서의 메시지 방향",
      "visual_direction": "비주얼 방향"
    }
  ],
  "cta": "추천 CTA 문구",
  "image_prompt_direction": "이미지 생성 시 참고할 방향 (영어로, Gemini 프롬프트에 활용)"
}

JSON만 출력하세요.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
}
