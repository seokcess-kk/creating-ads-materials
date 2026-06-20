export type CardNewsSlideRole = "hook" | "point" | "cta";

export interface CardNewsSlideOut {
  index: number;
  role: CardNewsSlideRole;
  kicker?: string;
  headline: string;
  body?: string;
  /** 합성 완료된 슬라이드 이미지 URL */
  url: string;
}

export interface CardNewsResult {
  title: string;
  bgUrl: string;
  slides: CardNewsSlideOut[];
}

export interface CardNewsRecord {
  id: string;
  campaign_id: string;
  title: string;
  bg_url: string | null;
  slides_json: CardNewsSlideOut[];
  status: string;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}
