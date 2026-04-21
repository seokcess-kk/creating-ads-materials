export type FrameworkId = "PAS" | "FAB" | "4U" | "AIDA" | "BAB";

export interface FrameworkPart {
  role: string;
  description: string;
  charLimit?: number;
}

export interface Framework {
  id: FrameworkId;
  name: string;
  summary: string;
  bestFor: string[];
  compatibleFunnels: Array<"TOFU" | "MOFU" | "BOFU">;
  structure: FrameworkPart[];
  promptHint: string;
  example?: {
    title: string;
    lines: string[];
  };
}
