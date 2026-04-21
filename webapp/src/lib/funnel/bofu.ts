import type { FunnelGuide } from "./types";

export const BOFU: FunnelGuide = {
  stage: "BOFU",
  goal: "전환 — 구매·신청·가입·체험",
  messaging: {
    primary: "오퍼·가격·혜택·긴급성",
    tone: "직설적·명확·신뢰 기반",
    cta: "명확한 행동 유도 (신청/구매/시작/받기)",
  },
  compatibleFrameworks: ["PAS", "FAB", "4U"],
  recommendedHooks: ["number", "benefit", "urgency"],
  avoid: [
    "브랜드 스토리·역사",
    "추상적 비전",
    "교육/설명형 롱폼",
    "인지도만 쌓는 문구",
  ],
  successSignals: ["CTR", "CVR", "CPC", "CPA"],
};
