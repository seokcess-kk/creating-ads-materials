import type { Playbook } from "./types";

export const TIKTOK_BOFU: Playbook = {
  version: "tiktok.bofu@1.0.0",
  channel: "tiktok",
  funnelStage: "BOFU",
  hookTypes: ["curiosity", "problem", "number", "insight", "benefit"],
  recommendedHooks: ["curiosity", "problem", "insight"],
  tone: {
    style: "캐주얼·UGC 느낌·자연스러운 리얼 톤",
    do: [
      "광고 같지 않은 자연스러운 대화",
      "짧고 툭 던지는 카피 (구어체 OK)",
      "'궁금하죠?' / '직접 해봤어요' 같은 1인칭",
      "트렌드 표현 자연스럽게",
    ],
    dont: [
      "정형화된 광고 문법",
      "격식·딱딱한 톤",
      "과도한 광고 레이아웃",
      "과장·결과 확약",
    ],
  },
  structure: {
    headline: {
      maxLen: 18,
      preferredLen: 12,
      emphasis: "호기심·반전·개인 경험",
    },
    subCopy: {
      maxLen: 32,
      preferredLen: 22,
      role: "맥락 제공 + 궁금증 유발",
    },
    cta: {
      maxLen: 8,
      preferredLen: 5,
      pattern: "동사형·친근 (알아보기/받기/체험)",
    },
  },
  visualGuide: {
    format: "9:16 세로, 1080x1920, 풀블리드",
    focus: [
      "얼굴·실제 사용 장면 중심",
      "스크린샷·리액션 요소",
      "배경 자연스러움 (스튜디오 느낌 X)",
      "텍스트는 최소, 화면 안에서 자연스럽게",
    ],
    avoid: [
      "정형화된 광고 레이아웃",
      "과도한 CG·가공",
      "모델 얼굴 클로즈업 + 데모그래픽 라벨",
      "텍스트 범벅",
    ],
    colorStrategy: "자연광 톤 + 브랜드 액센트만 포인트로",
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
  ],
  cta: {
    styles: ["pill button", "text-only CTA", "natural inline"],
    verbs: ["알아보기", "체험하기", "받아보기", "시작하기", "지금 확인"],
  },
  hashtagsUse: false,
  hashtagsReason: "페이드 TikTok 광고는 해시태그보다 자연스러운 카피가 효과적",
};
