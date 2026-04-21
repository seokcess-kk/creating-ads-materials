import type { Framework } from "./types";

export const PAS: Framework = {
  id: "PAS",
  name: "Problem · Agitate · Solution",
  summary: "문제 제기 → 고통 증폭 → 해결 제시",
  bestFor: ["문제 인식이 강한 타겟", "BOFU 전환"],
  compatibleFunnels: ["MOFU", "BOFU"],
  structure: [
    {
      role: "Problem",
      description: "타겟이 실제로 겪는 구체적 문제 한 줄",
      charLimit: 25,
    },
    {
      role: "Agitate",
      description: "문제가 방치될 때 발생할 부정적 결과를 증폭 (과장은 금지)",
      charLimit: 35,
    },
    {
      role: "Solution",
      description: "제품·서비스가 해결하는 방식 + 명확한 CTA",
      charLimit: 30,
    },
  ],
  promptHint:
    "Problem은 타겟 페르소나의 pains에서 가져오고, Agitate는 결과·시간 손실 중심으로, Solution은 USP와 오퍼 혜택을 짝지어 작성.",
  example: {
    title: "학원 BOFU",
    lines: [
      "수능까지 180일, 혼자 풀다 시간만 버린다",
      "모의고사 점수는 그대로, 불안만 쌓이는 중",
      "1:1 피드백으로 오답을 줄여드립니다 — 3개월 패키지 신청",
    ],
  },
};
