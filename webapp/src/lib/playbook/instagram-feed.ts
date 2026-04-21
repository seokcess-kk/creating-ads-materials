import type { Playbook } from "./types";

export const INSTAGRAM_FEED_BOFU: Playbook = {
  version: "ig_feed_square.bofu@1.0.0",
  channel: "ig_feed_square",
  funnelStage: "BOFU",
  hookTypes: ["benefit", "number", "urgency", "problem", "curiosity"],
  recommendedHooks: ["number", "benefit", "urgency"],
  tone: {
    style: "직설적·명확·행동 유도",
    do: [
      "구체적 수치 제시",
      "제품명·가격·기간 명시",
      "즉시 사용 가능한 혜택 강조",
      "한정성·긴급성 표시",
      "신뢰 증거(실적·수상) 병기",
    ],
    dont: [
      "막연한 수사(멋진 변화, 새로운 경험)",
      "과장 표현(완벽한, 무조건, 100%)",
      "추상적 이익(삶의 질 향상)",
      "Meta 정책 위반(before-after, 개인 속성 지칭)",
      "결과 확약 문구",
    ],
  },
  structure: {
    headline: {
      maxLen: 18,
      preferredLen: 12,
      emphasis: "숫자·혜택·긴급성",
    },
    subCopy: {
      maxLen: 35,
      preferredLen: 25,
      role: "헤드라인 보완, 증거·조건 제시",
    },
    cta: {
      maxLen: 8,
      preferredLen: 5,
      pattern: "동사형·즉시성 (신청/시작/받기)",
    },
  },
  visualGuide: {
    format: "1:1 square, 1080x1080, 풀블리드",
    focus: [
      "숫자·혜택을 가장 크게",
      "얼굴·제품 클로즈업",
      "배지/라벨로 긴급성 표시",
      "CTA 버튼 시각적 분리",
    ],
    avoid: [
      "텍스트가 이미지 60% 이상 차지",
      "배경·전경 대비 부족",
      "모호한 분위기 사진",
      "여러 제품 복합 나열",
    ],
    colorStrategy: "브랜드 primary 배경 + 대비색으로 숫자·CTA 강조",
  },
  taboos: [
    "100% 보장",
    "무조건",
    "역대급",
    "최고의",
    "완벽한",
    "before/after 대조",
    "개인 속성 단정적 지칭",
    "결과 확약 문구",
    "지나친 이모지 (2개 이하)",
  ],
  cta: {
    styles: ["pill button", "underline text", "arrow suffix"],
    verbs: [
      "신청하기",
      "시작하기",
      "받아보기",
      "알아보기",
      "지금 확인",
      "할인받기",
      "무료 체험",
    ],
  },
  hashtagsUse: false,
  hashtagsReason: "페이드 IG Feed 광고에서는 해시태그가 CTR에 기여하지 않음",
};
