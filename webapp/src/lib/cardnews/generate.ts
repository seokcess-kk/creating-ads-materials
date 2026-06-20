import { createClient } from "@/lib/supabase/server";
import { callClaude, extractToolUse } from "@/lib/engines/claude";
import { generateImage } from "@/lib/engines/gemini-image";
import { renderComposite, type ComposeConfig } from "@/lib/canvas/compositor";
import { extractNoticeMeta } from "@/lib/notice/extract";
import {
  CARDNEWS_TOOL_NAME,
  CardNewsOutlineSchema,
  buildCardNewsSystem,
  buildCardNewsMessages,
  cardNewsTool,
} from "@/lib/prompts/cardnews";
import { CARDNEWS_BG_PROMPT, cardNewsFontSet, slideConfig } from "./render";
import type { Campaign, NoticeMeta } from "@/lib/campaigns/types";
import type { CardNewsResult, CardNewsSlideOut } from "./types";

async function uploadSlide(campaignId: string, name: string, buf: Buffer): Promise<string> {
  const supabase = await createClient();
  const path = `${campaignId}/cardnews/${Date.now()}_${name}.png`;
  const { error } = await supabase.storage
    .from("generated-images")
    .upload(path, buf, { contentType: "image/png", upsert: true });
  if (error) throw error;
  return supabase.storage.from("generated-images").getPublicUrl(path).data.publicUrl;
}

/**
 * 원문(raw_content) → 카드뉴스 캐러셀(N장 합성 이미지).
 * 아웃라인(Claude) → 일관 배경 1장(Gemini) → 슬라이드별 renderComposite + 업로드.
 */
export async function generateCardNews(
  campaign: Campaign,
  opts?: { brandName?: string | null },
): Promise<CardNewsResult> {
  const raw = campaign.raw_content?.trim();
  if (!raw) throw new Error("원문(raw_content)이 없습니다");
  const isNotice = campaign.content_mode === "notice";

  // 정보 슬롯: 있으면 사용, notice인데 없으면 1회 추출(실패해도 진행)
  let noticeMeta: NoticeMeta | null = campaign.notice_meta;
  if (isNotice && !noticeMeta) {
    try {
      noticeMeta = await extractNoticeMeta(raw, {
        operation: "cardnews_extract",
        brandId: campaign.brand_id,
        campaignId: campaign.id,
      });
    } catch {
      noticeMeta = null;
    }
  }

  // 1) 아웃라인
  const resp = await callClaude({
    model: "opus",
    maxTokens: 3000,
    system: buildCardNewsSystem({ isNotice, toneOverride: campaign.tone_override }),
    usageContext: {
      operation: "cardnews_outline",
      brandId: campaign.brand_id,
      campaignId: campaign.id,
    },
    messages: buildCardNewsMessages({ rawContent: raw, noticeMeta, brandName: opts?.brandName }),
    tools: [cardNewsTool],
    toolChoice: { type: "tool", name: CARDNEWS_TOOL_NAME },
  });
  const rawOutline = extractToolUse(resp, CARDNEWS_TOOL_NAME);
  if (!rawOutline) throw new Error("카드뉴스 아웃라인 생성 실패");
  const outline = CardNewsOutlineSchema.parse(rawOutline);

  // 2) 일관 배경 1장(텍스트 없음) → 전 슬라이드 공통
  const bg = await generateImage({
    prompt: CARDNEWS_BG_PROMPT,
    aspectRatio: "1:1",
    imageSize: "2K",
    usageContext: {
      operation: "cardnews_bg",
      brandId: campaign.brand_id,
      campaignId: campaign.id,
    },
  });
  const bgBuf = Buffer.from(bg.base64, "base64");
  const bgUrl = await uploadSlide(campaign.id, "bg", bgBuf);

  // 3) 슬라이드별 합성 + 업로드
  const fontSet = cardNewsFontSet();
  const slides: CardNewsSlideOut[] = [];
  for (const s of outline.slides) {
    const config: ComposeConfig = {
      backgroundImageUrl: "",
      output: { bucket: "", path: "" },
      fontSet,
      ...slideConfig(s, outline.slides.length),
    };
    const buf = await renderComposite(bgBuf, config);
    const url = await uploadSlide(campaign.id, `slide_${String(s.index).padStart(2, "0")}`, buf);
    slides.push({
      index: s.index,
      role: s.role,
      kicker: s.kicker,
      headline: s.headline,
      body: s.body,
      url,
    });
  }

  return { title: outline.title, bgUrl, slides };
}
