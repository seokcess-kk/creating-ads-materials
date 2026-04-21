import type { FrameworkId } from "@/lib/frameworks/types";
import type { HookType } from "@/lib/playbook/types";

export type FunnelStage = "TOFU" | "MOFU" | "BOFU";

export interface FunnelGuide {
  stage: FunnelStage;
  goal: string;
  messaging: {
    primary: string;
    tone: string;
    cta: string;
  };
  compatibleFrameworks: FrameworkId[];
  recommendedHooks: HookType[];
  avoid: string[];
  successSignals: string[];
}
