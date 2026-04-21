import type { Framework } from "./types";

export const FAB: Framework = {
  id: "FAB",
  name: "Feature · Advantage · Benefit",
  summary: "기능 → 강점 → 고객 이익",
  bestFor: ["구체 기능 차별화가 명확한 제품", "BOFU 전환"],
  compatibleFunnels: ["MOFU", "BOFU"],
  structure: [
    {
      role: "Feature",
      description: "제품의 핵심 기능·사양 (객관적 사실)",
      charLimit: 20,
    },
    {
      role: "Advantage",
      description: "그 기능이 경쟁사 대비 주는 강점 (상대적 비교)",
      charLimit: 30,
    },
    {
      role: "Benefit",
      description: "최종 사용자에게 돌아가는 이익 + CTA",
      charLimit: 30,
    },
  ],
  promptHint:
    "Feature는 offers.usp에서 출발, Advantage는 증거(evidence)와 결합, Benefit은 페르소나의 desires와 연결.",
  example: {
    title: "학원 BOFU",
    lines: [
      "AI 오답노트 자동 생성",
      "수동 정리 대비 학습 시간 40% 절감",
      "남은 시간을 고난도 문항 풀이에 — 3개월 패키지 신청",
    ],
  },
};
