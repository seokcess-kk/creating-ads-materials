import type { Framework } from "./types";

export const FOUR_U: Framework = {
  id: "4U",
  name: "Useful · Urgent · Unique · Ultra-specific",
  summary: "유용성·긴급성·독창성·초구체성 — 헤드라인 체크 프레임",
  bestFor: ["임팩트 헤드라인", "BOFU 짧은 광고"],
  compatibleFunnels: ["BOFU"],
  structure: [
    {
      role: "Useful",
      description: "타겟에게 실질적으로 유용한가",
    },
    {
      role: "Urgent",
      description: "즉시 행동해야 할 이유(기한·한정)가 있는가",
    },
    {
      role: "Unique",
      description: "다른 광고와 구별되는 각도인가",
    },
    {
      role: "Ultra-specific",
      description: "모호하지 않고 수치·조건이 구체적인가",
    },
  ],
  promptHint:
    "4U는 독립 구조가 아니라 헤드라인을 4축으로 자체 점검. 각 카피 변형이 4개 기준을 모두 충족하는지 확인하고 부족한 축을 보완.",
  example: {
    title: "학원 BOFU 헤드라인",
    lines: [
      "Useful: '수능 3개월 점수 올리는 법'",
      "Urgent: '3/15까지 선착순 100명'",
      "Unique: '1:1 피드백 + AI 오답노트'",
      "Ultra-specific: '월 99,000원, 작년 1등급 87%'",
    ],
  },
};
