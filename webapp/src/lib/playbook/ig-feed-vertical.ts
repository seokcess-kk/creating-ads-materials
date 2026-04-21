import type { Playbook } from "./types";

export const INSTAGRAM_FEED_VERTICAL_BOFU: Playbook = {
  version: "ig_feed_vertical.bofu@1.0.0",
  channel: "ig_feed_vertical",
  funnelStage: "BOFU",
  hookTypes: ["benefit", "number", "urgency", "problem", "curiosity"],
  recommendedHooks: ["number", "benefit", "urgency"],
  tone: {
    style: "세로 영역을 활용한 계층적 설득",
    do: [
      "상/중/하 3구간 시각 계층",
      "구체적 수치·제품명·가격 명시",
      "즉시 사용 가능한 혜택 강조",
      "한정성·긴급성 표시",
    ],
    dont: [
      "가로형 구성을 그대로 재활용",
      "막연한 수사(멋진 변화, 새로운 경험)",
      "과장 표현·결과 확약",
      "Meta 정책 위반 (before-after, 개인 속성 지칭)",
    ],
  },
  structure: {
    headline: {
      maxLen: 20,
      preferredLen: 14,
      emphasis: "숫자·혜택·긴급성",
    },
    subCopy: {
      maxLen: 38,
      preferredLen: 28,
      role: "헤드라인 보완, 증거·조건 제시",
    },
    cta: {
      maxLen: 8,
      preferredLen: 5,
      pattern: "동사형·즉시성",
    },
  },
  visualGuide: {
    format: "4:5 세로, 1080x1350, 풀블리드",
    focus: [
      "상단 — 헤드라인 + 숫자 강조",
      "중단 — 제품·인물 또는 핵심 시각 요소",
      "하단 — CTA 버튼 + 증거·조건",
      "세로 영역을 최대한 활용한 시각 위계",
    ],
    avoid: [
      "1:1용 구성을 그대로 확장",
      "텍스트가 이미지 60% 이상 차지",
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
  ],
  cta: {
    styles: ["pill button", "underline text", "arrow suffix"],
    verbs: ["신청하기", "시작하기", "받아보기", "알아보기", "지금 확인", "할인받기"],
  },
  hashtagsUse: false,
  hashtagsReason: "페이드 IG Feed 광고에서는 해시태그가 CTR에 기여하지 않음",
};
