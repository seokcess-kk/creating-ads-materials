import type { FunnelGuide, FunnelStage } from "./types";
import { BOFU } from "./bofu";
import { NOTICE_GUIDE } from "./notice";

export * from "./types";
export * from "./bofu";
export { NOTICE_GUIDE } from "./notice";

const GUIDES: Partial<Record<FunnelStage, FunnelGuide>> = {
  BOFU,
};

export function getFunnelGuide(stage: FunnelStage): FunnelGuide {
  const g = GUIDES[stage];
  if (!g) throw new Error(`Funnel guide not available: ${stage}. 현재 BOFU만 지원.`);
  return g;
}

/**
 * 캠페인의 content_mode 에 맞는 funnel 가이드 선택.
 * notice 모드는 설득형 BOFU 대신 정보 전달 가이드를 쓴다.
 */
export function resolveFunnelGuide(
  goal: FunnelStage,
  contentMode: "persuasion" | "notice",
): FunnelGuide {
  if (contentMode === "notice") return NOTICE_GUIDE;
  return getFunnelGuide(goal);
}

export function isActiveFunnelStage(stage: FunnelStage): boolean {
  return Boolean(GUIDES[stage]);
}
