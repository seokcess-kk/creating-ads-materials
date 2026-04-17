import { getClaudeClient } from "./client";
import { getCampaign } from "@/lib/db/campaigns";

export async function generateCopy(campaignId: string) {
  const claude = getClaudeClient();
  const campaign = await getCampaign(campaignId);
  const brief = campaign.brief_json as Record<string, unknown>;

  const prompt = `당신은 디지털 광고 카피라이터입니다. 아래 브리프를 기반으로 채널별 광고 카피를 작성하세요.

브리프:
${JSON.stringify(brief, null, 2)}

채널: ${JSON.stringify(campaign.target_channels)}

각 채널별로 5개 카피 변형을 JSON으로 출력하세요:
{
  "copies": [
    {
      "channel": "채널ID",
      "variations": [
        {
          "angle": "앵글명 (혜택/문제해결/사회적증거/긴급성/호기심 등)",
          "headline": "메인 헤드라인 (15자 내외)",
          "sub_copy": "서브 카피 (25자 내외)",
          "cta": "CTA (10자 내외)",
          "body": "본문 (125자 내외, SNS용)"
        }
      ]
    }
  ]
}

규칙:
- 한국어로 작성
- 각 변형은 다른 앵글/어조를 사용 (단순 단어 교체 금지)
- 채널별 글자수 제한 준수
- CTA는 구체적 행동 동사형

JSON만 출력하세요.`;

  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
}
