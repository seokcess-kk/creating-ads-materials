export type HookType =
  | "empathy"
  | "problem"
  | "insight"
  | "emotion"
  | "curiosity"
  | "number"
  | "benefit"
  | "urgency";

export interface PlaybookTone {
  style: string;
  do: string[];
  dont: string[];
}

export interface PlaybookStructure {
  headline: { maxLen: number; preferredLen: number; emphasis: string };
  subCopy: { maxLen: number; preferredLen: number; role: string };
  cta: { maxLen: number; preferredLen: number; pattern: string };
}

export interface PlaybookVisualGuide {
  format: string;
  focus: string[];
  avoid: string[];
  colorStrategy: string;
}

export interface PlaybookCta {
  styles: string[];
  verbs: string[];
}

export interface Playbook {
  version: string;
  channel: string;
  funnelStage: "TOFU" | "MOFU" | "BOFU";
  hookTypes: HookType[];
  recommendedHooks: HookType[];
  tone: PlaybookTone;
  structure: PlaybookStructure;
  visualGuide: PlaybookVisualGuide;
  taboos: string[];
  cta: PlaybookCta;
  hashtagsUse: boolean;
  hashtagsReason?: string;
}
