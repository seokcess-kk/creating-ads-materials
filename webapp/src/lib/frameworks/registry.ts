import type { Framework, FrameworkId } from "./types";
import { PAS } from "./pas";
import { FAB } from "./fab";
import { FOUR_U } from "./four-u";

const REGISTRY: Record<FrameworkId, Framework> = {
  PAS,
  FAB,
  "4U": FOUR_U,
  AIDA: PAS,
  BAB: PAS,
};

export function getFramework(id: FrameworkId): Framework {
  const f = REGISTRY[id];
  if (!f) throw new Error(`Framework not found: ${id}`);
  return f;
}

export function listFrameworks(funnelStage?: "TOFU" | "MOFU" | "BOFU"): Framework[] {
  const unique = [PAS, FAB, FOUR_U];
  if (!funnelStage) return unique;
  return unique.filter((f) => f.compatibleFunnels.includes(funnelStage));
}

export function recommendFrameworksFor(
  funnelStage: "TOFU" | "MOFU" | "BOFU",
): FrameworkId[] {
  if (funnelStage === "BOFU") return ["PAS", "FAB", "4U"];
  if (funnelStage === "MOFU") return ["PAS", "FAB"];
  return [];
}
