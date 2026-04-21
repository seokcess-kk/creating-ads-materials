import type { Playbook } from "./types";

export const FACEBOOK_FEED_BOFU: Playbook = {
  version: "fb_feed_square.bofu@1.0.0",
  channel: "fb_feed_square",
  funnelStage: "BOFU",
  hookTypes: ["benefit", "empathy", "number", "problem", "curiosity"],
  recommendedHooks: ["empathy", "benefit", "number"],
  tone: {
    style: "대화형·신뢰 기반·성인 독자 친화",
    do: [
      "1인칭·2인칭 말걸기 ('혹시 이런 적 있으신가요?')",
      "구체적 맥락·상황 묘사 후 해결 제시",
      "수치·증거를 신뢰 요소로 병기",
      "공식적이되 과도한 격식 X",
    ],
    dont: [
      "IG 감성 카피 복붙",
      "10·20대 슬랭",
      "추상적 수사·감성 과잉",
      "과장·결과 확약",
    ],
  },
  structure: {
    headline: {
      maxLen: 22,
      preferredLen: 16,
      emphasis: "공감·혜택·구체 수치",
    },
    subCopy: {
      maxLen: 45,
      preferredLen: 32,
      role: "상황 보완 + 증거 제시",
    },
    cta: {
      maxLen: 10,
      preferredLen: 6,
      pattern: "동사형·신뢰 톤 (알아보기/신청하기/자세히)",
    },
  },
  visualGuide: {
    format: "1:1 1080x1080, 피드 가독성 우선",
    focus: [
      "얼굴·제품·설득 증거(수치) 명확",
      "텍스트 과하지 않되 전달력 강한 배치",
      "브랜드 컬러 + 신뢰감 있는 톤",
    ],
    avoid: [
      "10대 슬랭 그래픽",
      "지나치게 트렌디한 비주얼",
      "전문성·신뢰가 떨어지는 구도",
    ],
    colorStrategy: "안정적 대비·파스텔 피하고 명확한 위계",
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
    styles: ["pill button", "rectangle", "underline text"],
    verbs: [
      "신청하기",
      "자세히 보기",
      "알아보기",
      "상담 받기",
      "무료 체험",
      "지금 시작",
    ],
  },
  hashtagsUse: false,
  hashtagsReason: "페이드 FB 광고에서는 해시태그가 CTR에 기여하지 않음",
};
