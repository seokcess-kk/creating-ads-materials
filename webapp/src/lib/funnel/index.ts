import type { FunnelGuide, FunnelStage } from "./types";
import { BOFU } from "./bofu";

export * from "./types";
export * from "./bofu";

const GUIDES: Partial<Record<FunnelStage, FunnelGuide>> = {
  BOFU,
};

export function getFunnelGuide(stage: FunnelStage): FunnelGuide {
  const g = GUIDES[stage];
  if (!g) throw new Error(`Funnel guide not available: ${stage}. 현재 BOFU만 지원.`);
  return g;
}

export function isActiveFunnelStage(stage: FunnelStage): boolean {
  return Boolean(GUIDES[stage]);
}
