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
        name: "Light",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Light.woff2",
        publicFile: "pretendard/Pretendard-Light.woff2",
        localCandidates: ["Pretendard-Light.otf", "Pretendard-Light.ttf"],
      },
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
        name: "SemiBold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-SemiBold.woff2",
        publicFile: "pretendard/Pretendard-SemiBold.woff2",
        localCandidates: ["Pretendard-SemiBold.otf", "Pretendard-SemiBold.ttf"],
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
  // Noto Sans KR: 프리셋 어디에도 참조되지 않고 32MB 부담 — 제거
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
        name: "Light",
        cdnUrl: "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT-Light.woff2",
        publicFile: "suit/SUIT-Light.woff2",
        localCandidates: ["SUIT-Light.ttf", "SUIT-Light.otf"],
      },
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
      {
        name: "ExtraBold",
        cdnUrl: "https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT-ExtraBold.woff2",
        publicFile: "suit/SUIT-ExtraBold.woff2",
        localCandidates: ["SUIT-ExtraBold.ttf", "SUIT-ExtraBold.otf"],
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
        name: "ExtraBold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-square-round@5.1.0/files/nanum-square-round-korean-800-normal.woff2",
        publicFile: "nanum-square-round/NanumSquareRound-ExtraBold.woff2",
        localCandidates: ["NanumSquareRoundEB.ttf", "NanumSquareRound-ExtraBold.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-square-round@5.1.0/files/nanum-square-round-korean-700-normal.woff2",
        publicFile: "nanum-square-round/NanumSquareRound-Bold.woff2",
        localCandidates: ["NanumSquareRoundB.ttf", "NanumSquareRound-Bold.ttf"],
      },
      {
        name: "Light",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-square-round@5.1.0/files/nanum-square-round-korean-300-normal.woff2",
        publicFile: "nanum-square-round/NanumSquareRound-Light.woff2",
        localCandidates: ["NanumSquareRoundL.ttf", "NanumSquareRound-Light.ttf"],
      },
    ],
  },
  // ───── Shopping / Promo ─────
  {
    family: "GmarketSans",
    category: "impact_display",
    tone_tags: ["bold", "impact", "display", "shopping", "ecommerce"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "cta", "brand"],
    license: "G마켓 저작권 허용 (상업 사용 가능)",
    source: "https://corp.gmarket.com/fonts/",
    weights: [
      {
        name: "Bold",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "gmarket-sans/GmarketSans-Bold.ttf",
        localCandidates: ["GmarketSansTTFBold.ttf", "GmarketSans-Bold.ttf"],
      },
      {
        name: "Medium",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "gmarket-sans/GmarketSans-Medium.ttf",
        localCandidates: ["GmarketSansTTFMedium.ttf"],
      },
      {
        name: "Light",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "gmarket-sans/GmarketSans-Light.ttf",
        localCandidates: ["GmarketSansTTFLight.ttf"],
      },
    ],
  },
  {
    family: "Jalnan2",
    category: "impact_display",
    tone_tags: ["bold", "impact", "display", "event", "loud"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "cta"],
    license: "야놀자 잘난체 2 — 상업 사용 허용",
    source: "https://www.yanolja.com/fonts/jalnan2",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "jalnan2/Jalnan2.ttf",
        localCandidates: ["Jalnan2TTF.ttf", "Jalnan2.otf"],
      },
    ],
  },
  {
    family: "JalnanGothic",
    category: "impact_display",
    tone_tags: ["bold", "impact", "display", "event"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "slogan"],
    license: "야놀자 잘난고딕 — 상업 사용 허용",
    source: "https://www.yanolja.com/fonts/jalnan",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "jalnan-gothic/JalnanGothic.ttf",
        localCandidates: ["JalnanGothicTTF.ttf", "JalnanGothic.otf"],
      },
    ],
  },
  // ───── Emotional / Story ─────
  {
    family: "NanumMyeongjo",
    category: "serif",
    tone_tags: ["elegant", "classic", "serif", "refined", "romantic"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "brand"],
    license: "SIL OFL 1.1",
    source: "https://hangeul.naver.com/font/nanum",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-myeongjo@5.0.18/files/nanum-myeongjo-korean-400-normal.woff2",
        publicFile: "nanum-myeongjo/NanumMyeongjo-Regular.woff2",
        localCandidates: ["NanumMyeongjo.ttf", "NanumMyeongjo-Regular.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-myeongjo@5.0.18/files/nanum-myeongjo-korean-700-normal.woff2",
        publicFile: "nanum-myeongjo/NanumMyeongjo-Bold.woff2",
        localCandidates: ["NanumMyeongjoBold.ttf", "NanumMyeongjo-Bold.ttf"],
      },
      {
        name: "ExtraBold",
        cdnUrl: "https://cdn.jsdelivr.net/npm/@fontsource/nanum-myeongjo@5.0.18/files/nanum-myeongjo-korean-800-normal.woff2",
        publicFile: "nanum-myeongjo/NanumMyeongjo-ExtraBold.woff2",
        localCandidates: ["NanumMyeongjoExtraBold.ttf", "NanumMyeongjo-ExtraBold.ttf"],
      },
    ],
  },
  {
    family: "NanumBarunpen",
    category: "handwriting",
    tone_tags: ["emotional", "personal", "warm", "handwritten"],
    language_support: ["ko", "en"],
    recommended_roles: ["slogan", "sub"],
    license: "SIL OFL 1.1",
    source: "https://hangeul.naver.com/font/nanum",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "nanum-barunpen/NanumBarunpen-Regular.ttf",
        localCandidates: ["NanumBarunpenR.ttf"],
      },
      {
        name: "Bold",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "nanum-barunpen/NanumBarunpen-Bold.ttf",
        localCandidates: ["NanumBarunpenB.ttf"],
      },
    ],
  },
  // ───── Impact / Event ─────
  {
    family: "SCDream",
    category: "premium_sans",
    tone_tags: ["modern", "premium", "geometric", "event"],
    language_support: ["ko", "en"],
    recommended_roles: ["headline", "sub", "cta", "brand"],
    license: "S-Core 드림체 — 상업 사용 허용",
    source: "https://sandoll.co.kr/font/SCDream",
    weights: [
      {
        name: "3",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "scdream/SCDream3.otf",
        localCandidates: ["SCDream3.otf"],
      },
      {
        name: "5",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "scdream/SCDream5.otf",
        localCandidates: ["SCDream5.otf"],
      },
      {
        name: "7",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "scdream/SCDream7.otf",
        localCandidates: ["SCDream7.otf"],
      },
      {
        name: "9",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "scdream/SCDream9.otf",
        localCandidates: ["SCDream9.otf"],
      },
    ],
  },
  {
    family: "CAFE24DANJUNGHAE",
    category: "handwriting",
    tone_tags: ["emotional", "warm", "handwritten", "slogan"],
    language_support: ["ko", "en"],
    recommended_roles: ["slogan"],
    license: "Cafe24 단정해 — 상업 사용 허용",
    source: "https://fonts.cafe24.com/",
    weights: [
      {
        name: "Regular",
        cdnUrl: "https://unavailable.cdn/placeholder",
        publicFile: "cafe24-danjunghae/CAFE24DANJUNGHAE.ttf",
        localCandidates: ["CAFE24DANJUNGHAE.TTF", "Cafe24Danjunghae.ttf"],
      },
    ],
  },
];
