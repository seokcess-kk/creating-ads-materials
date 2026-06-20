import type { FunnelGuide } from "./types";

// 안내문(notice) 전용 가이드.
// stage 는 FunnelStage 타입 제약상 "BOFU" 로 두지만(=BP digest 재가중 키로만 쓰임,
// ad-hoc 안내문은 BP 이력이 없어 영향 미미), messaging/hooks/avoid 는 정보 전달 성격에 맞춘다.
// 설득형 BOFU 와 달리 과장·확약·프리미엄 미감을 회피 대상으로 명시한다.
export const NOTICE_GUIDE: FunnelGuide = {
  stage: "BOFU",
  goal: "정보 전달 — 핵심 안내 + 신청·확인 행동 유도",
  messaging: {
    primary: "모집·일정·대상·신청 경로 등 핵심 정보의 명확한 전달",
    tone: "사무적·정확·신뢰. 과장·감탄·물결표 배제",
    cta: "신청/확인/자세히 보기 등 행동 경로 명시",
  },
  compatibleFrameworks: ["4U"],
  recommendedHooks: ["number", "benefit"],
  avoid: [
    "과장·결과 확약",
    "프리미엄 과시·감성 수사",
    "설득형 hook 남발",
    "before/after 대조",
    "불필요한 긴급성 연출(실제 마감만 사실대로)",
  ],
  successSignals: ["신청 완료수", "정보 도달", "문의 감소"],
};
