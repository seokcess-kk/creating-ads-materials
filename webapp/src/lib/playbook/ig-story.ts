import type { Playbook } from "./types";

export const INSTAGRAM_STORY_BOFU: Playbook = {
  version: "ig_story.bofu@1.0.0",
  channel: "ig_story",
  funnelStage: "BOFU",
  hookTypes: ["benefit", "number", "urgency", "curiosity", "problem"],
  recommendedHooks: ["urgency", "number", "curiosity"],
  tone: {
    style: "몰입적·즉각적·가벼운 긴장감",
    do: [
      "첫 1~2초 내 시선 고정",
      "수치·기한·혜택을 한 화면에 명확히",
      "스와이프·탭을 유도하는 CTA (하단 배치)",
      "개인적·일상적 톤 (친근한 1인칭)",
    ],
    dont: [
      "복잡한 레이아웃·긴 텍스트",
      "중앙 하단(CTA 영역)에 이미지 덮기",
      "광고 티 나는 정형화된 레이아웃",
      "과장·결과 확약",
    ],
  },
  structure: {
    headline: {
      maxLen: 14,
      preferredLen: 9,
      emphasis: "숫자·혜택·호기심",
    },
    subCopy: {
      maxLen: 28,
      preferredLen: 20,
      role: "헤드라인 보완, 한 줄 증거·조건",
    },
    cta: {
      maxLen: 8,
      preferredLen: 4,
      pattern: "하단 배치, 짧은 동사형 (탭/시작/받기)",
    },
  },
  visualGuide: {
    format: "9:16 세로, 1080x1920, 풀블리드",
    focus: [
      "상단 40% — 헤드라인과 핵심 숫자",
      "중앙 40% — 얼굴·제품·UI 포커스",
      "하단 20% — CTA 영역, 여백 여유",
      "세로 흐름(위→아래) 시선 유도",
    ],
    avoid: [
      "하단 안전 영역에 중요 요소 배치 (Instagram UI 가림)",
      "가로형 구성",
      "텍스트 과다",
      "정적·딱딱한 구도",
    ],
    colorStrategy: "풀스크린 대비, primary + accent로 계층 뚜렷이",
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
    styles: ["pill button", "swipe-up cue", "tap hint"],
    verbs: ["지금 시작", "탭하기", "받아보기", "알아보기", "무료 체험"],
  },
  hashtagsUse: false,
  hashtagsReason: "페이드 스토리 광고에서는 해시태그가 CTR에 기여하지 않음",
};
