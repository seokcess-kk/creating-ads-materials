import type { FontTier } from "@/lib/memory/types";

export interface Tier1FontWeight {
  name: string;
  cdnUrl: string;
  publicFile: string;
  localCandidates: string[];
}

export interface Tier1FontFamily {
  family: string;
  weights: Tier1FontWeight[];
  category: string;
  tone_tags: string[];
  language_support: string[];
  recommended_roles: string[];
  license: string;
  licenseUrl?: string;
  source: string;
}

export const TIER: FontTier = "tier1";

export const TIER1_FAMILIES: Tier1FontFamily[] = [
  {
    family: "Pretendard",
    category: "premium_sans",
    tone_tags: ["modern", "premium", "clean", "neutral"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "cta", "brand", "slogan"],
    license: "SIL OFL 1.1",
    licenseUrl: "https://github.com/orioncactus/pretendard/blob/main/LICENSE",
    source: "https://github.com/orioncactus/pretendard",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2",
        publicFile: "pretendard/Pretendard-Regular.woff2",
        localCandidates: ["Pretendard-Regular.otf", "Pretendard-Regular.ttf"],
      },
      {
        name: "Medium",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Medium.woff2",
        publicFile: "pretendard/Pretendard-Medium.woff2",
        localCandidates: ["Pretendard-Medium.otf", "Pretendard-Medium.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2",
        publicFile: "pretendard/Pretendard-Bold.woff2",
        localCandidates: ["Pretendard-Bold.otf", "Pretendard-Bold.ttf"],
      },
      {
        name: "ExtraBold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-ExtraBold.woff2",
        publicFile: "pretendard/Pretendard-ExtraBold.woff2",
        localCandidates: ["Pretendard-ExtraBold.otf", "Pretendard-ExtraBold.ttf"],
      },
    ],
  },
  {
    family: "Noto Sans KR",
    category: "premium_sans",
    tone_tags: ["stable", "readable", "neutral"],
    language_support: ["ko", "en"],
    recommended_roles: ["sub", "body", "brand"],
    license: "SIL OFL 1.1",
    source: "https://fonts.google.com/noto/specimen/Noto+Sans+KR",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.19/files/noto-sans-kr-korean-400-normal.woff2",
        publicFile: "noto-sans-kr/NotoSansKR-Regular.woff2",
        localCandidates: ["NotoSansKR-Regular.otf", "NotoSansKR-Regular.ttf", "NotoSansCJKkr-Regular.otf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.19/files/noto-sans-kr-korean-700-normal.woff2",
        publicFile: "noto-sans-kr/NotoSansKR-Bold.woff2",
        localCandidates: ["NotoSansKR-Bold.otf", "NotoSansKR-Bold.ttf", "NotoSansCJKkr-Bold.otf"],
      },
    ],
  },
  {
    family: "SUIT",
    category: "premium_sans",
    tone_tags: ["modern", "clean", "tech"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "cta"],
    license: "SIL OFL 1.1",
    source: "https://github.com/sun-typeface/SUIT",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT-Regular.woff2",
        publicFile: "suit/SUIT-Regular.woff2",
        localCandidates: ["SUIT-Regular.ttf", "SUIT-Regular.otf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT-Bold.woff2",
        publicFile: "suit/SUIT-Bold.woff2",
        localCandidates: ["SUIT-Bold.ttf", "SUIT-Bold.otf"],
      },
    ],
  },
  {
    family: "Spoqa Han Sans Neo",
    category: "premium_sans",
    tone_tags: ["technical", "clean", "it", "startup"],
    language_support: ["ko", "en"],
    recommended_roles: ["sub", "brand"],
    license: "SIL OFL 1.1",
    source: "https://github.com/spoqa/spoqa-han-sans",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@master/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Regular.woff2",
        publicFile: "spoqa-han-sans-neo/SpoqaHanSansNeo-Regular.woff2",
        localCandidates: ["SpoqaHanSansNeo-Regular.otf", "SpoqaHanSansNeo-Regular.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/gh/spoqa/spoqa-han-sans@master/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-Bold.woff2",
        publicFile: "spoqa-han-sans-neo/SpoqaHanSansNeo-Bold.woff2",
        localCandidates: ["SpoqaHanSansNeo-Bold.otf", "SpoqaHanSansNeo-Bold.ttf"],
      },
    ],
  },
  {
    family: "NanumSquareRound",
    category: "rounded_sans",
    tone_tags: ["friendly", "soft", "lifestyle", "fnb"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "cta", "brand"],
    license: "SIL OFL 1.1",
    source: "https://hangeul.naver.com/font/nanum",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-square-round@5.1.0/files/nanum-square-round-korean-400-normal.woff2",
        publicFile: "nanum-square-round/NanumSquareRound-Regular.woff2",
        localCandidates: ["NanumSquareRoundR.ttf", "NanumSquareRound-Regular.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-square-round@5.1.0/files/nanum-square-round-korean-700-normal.woff2",
        publicFile: "nanum-square-round/NanumSquareRound-Bold.woff2",
        localCandidates: ["NanumSquareRoundB.ttf", "NanumSquareRound-Bold.ttf"],
      },
    ],
  },
];
