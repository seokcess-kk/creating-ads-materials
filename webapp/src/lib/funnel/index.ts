import type { FunnelGuide, FunnelStage } from "./types";
import { BOFU } from "./bofu";

export * from "./types";
export * from "./bofu";

const GUIDES: Partial<Record<FunnelStage, FunnelGuide>> = {
  BOFU,
};

export function getFunnelGuide(stage: FunnelStage): FunnelGuide {
  const g = GUIDES[stage];
  if (!g) throw new Error(`Funnel guide not available: ${stage}. M2는 BOFU 전용.`);
  return g;
}

export function isActiveFunnelStage(stage: FunnelStage): boolean {
  return Boolean(GUIDES[stage]);
}
