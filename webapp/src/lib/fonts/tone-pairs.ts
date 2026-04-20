import type { FontRole } from "@/lib/memory/types";

export type TonePresetId =
  | "premium_trust"
  | "shopping_promo"
  | "casual_friendly"
  | "emotional_story"
  | "minimal_tech"
  | "impact_event";

export interface TonePreset {
  id: TonePresetId;
  label: string;
  description: string;
  matchIndustries: string[];
  roles: Record<FontRole, { family: string; weight: string }>;
}

export const TONE_PRESETS: TonePreset[] = [
  {
    id: "premium_trust",
    label: "프리미엄 / 신뢰",
    description: "학원, 금융, 부동산, B2B",
    matchIndustries: ["education", "finance", "real_estate", "b2b", "healthcare"],
    roles: {
      headline: { family: "Pretendard", weight: "ExtraBold" },
      sub: { family: "Pretendard", weight: "Medium" },
      cta: { family: "Pretendard", weight: "Bold" },
      brand: { family: "Pretendard", weight: "SemiBold" },
      slogan: { family: "Pretendard", weight: "Regular" },
    },
  },
  {
    id: "shopping_promo",
    label: "쇼핑 / 프로모션",
    description: "이커머스, 세일, 할인",
    matchIndustries: ["ecommerce", "retail", "fashion"],
    roles: {
      headline: { family: "GmarketSans", weight: "Bold" },
      sub: { family: "GmarketSans", weight: "Medium" },
      cta: { family: "Jalnan2", weight: "Regular" },
      brand: { family: "Pretendard", weight: "SemiBold" },
      slogan: { family: "JalnanGothic", weight: "Regular" },
    },
  },
  {
    id: "casual_friendly",
    label: "캐주얼 / 친근",
    description: "F&B, 라이프스타일, 생활",
    matchIndustries: ["food", "beverage", "lifestyle", "home"],
    roles: {
      headline: { family: "NanumSquareRound", weight: "ExtraBold" },
      sub: { family: "NanumSquareRound", weight: "Regular" },
      cta: { family: "NanumSquareRound", weight: "Bold" },
      brand: { family: "Pretendard", weight: "SemiBold" },
      slogan: { family: "NanumSquareRound", weight: "Light" },
    },
  },
  {
    id: "emotional_story",
    label: "감성 / 스토리텔링",
    description: "뷰티, 여행, 에세이",
    matchIndustries: ["beauty", "travel", "wellness", "culture"],
    roles: {
      headline: { family: "NanumMyeongjo", weight: "ExtraBold" },
      sub: { family: "Pretendard", weight: "Light" },
      cta: { family: "Pretendard", weight: "Medium" },
      brand: { family: "Pretendard", weight: "Light" },
      slogan: { family: "NanumBarunpen", weight: "Regular" },
    },
  },
  {
    id: "minimal_tech",
    label: "미니멀 / 테크",
    description: "IT, SaaS, 스타트업",
    matchIndustries: ["it", "saas", "startup", "fintech"],
    roles: {
      headline: { family: "SUIT", weight: "ExtraBold" },
      sub: { family: "SUIT", weight: "Regular" },
      cta: { family: "SUIT", weight: "Bold" },
      brand: { family: "Spoqa Han Sans Neo", weight: "Bold" },
      slogan: { family: "SUIT", weight: "Light" },
    },
  },
  {
    id: "impact_event",
    label: "강렬 / 이벤트",
    description: "게임, 런칭, 대형 프로모션",
    matchIndustries: ["gaming", "entertainment", "event"],
    roles: {
      headline: { family: "Jalnan2", weight: "Regular" },
      sub: { family: "SCDream", weight: "5" },
      cta: { family: "SCDream", weight: "7" },
      brand: { family: "Pretendard", weight: "Bold" },
      slogan: { family: "CAFE24DANJUNGHAE", weight: "Regular" },
    },
  },
];

export function findPresetByIndustry(industry: string | null | undefined): TonePreset | null {
  if (!industry) return null;
  const normalized = industry.toLowerCase();
  return (
    TONE_PRESETS.find((p) =>
      p.matchIndustries.some((i) => normalized.includes(i) || i.includes(normalized)),
    ) ?? null
  );
}

export function getPresetById(id: TonePresetId): TonePreset | null {
  return TONE_PRESETS.find((p) => p.id === id) ?? null;
}
