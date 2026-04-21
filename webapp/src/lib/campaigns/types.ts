export type CampaignGoal = "TOFU" | "MOFU" | "BOFU";
export type CampaignStatus = "draft" | "running" | "completed" | "abandoned";
export type CreativeStageName =
  | "strategy"
  | "copy"
  | "visual"
  | "retouch"
  | "compose"
  | "ship";
export type RunStatus =
  | "pending"
  | "strategy"
  | "copy"
  | "visual"
  | "retouch"
  | "compose"
  | "ship"
  | "complete"
  | "failed";
export type StageStatus = "pending" | "running" | "ready" | "failed";

export interface Campaign {
  id: string;
  brand_id: string;
  name: string;
  goal: CampaignGoal;
  offer_id: string | null;
  audience_id: string | null;
  channel: string;
  constraints_json: Record<string, unknown>;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CreativeRun {
  id: string;
  campaign_id: string;
  status: RunStatus;
  current_stage: CreativeStageName | null;
  brand_memory_snapshot: Record<string, unknown>;
  playbook_version: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  rating: number | null;
  note: string | null;
  rated_at: string | null;
}

export interface CreativeStageRow {
  id: string;
  run_id: string;
  stage: CreativeStageName;
  status: StageStatus;
  input_json: Record<string, unknown>;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface CreativeVariant {
  id: string;
  stage_id: string;
  label: string;
  content_json: Record<string, unknown>;
  scores_json: Record<string, unknown>;
  prompt_version: string | null;
  selected: boolean;
  created_at: string;
}

export interface CampaignIntent {
  name: string;
  goal: CampaignGoal;
  offer_id: string | null;
  audience_id: string | null;
  channel: string;
  constraints?: Record<string, unknown>;
}
