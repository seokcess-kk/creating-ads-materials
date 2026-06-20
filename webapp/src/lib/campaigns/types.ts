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
export type StageStatus = "pending" | "running" | "ready" | "failed" | "stale";

export type AutomationLevel = "manual" | "assist" | "auto";

export type ContentMode = "persuasion" | "notice";

/** 출력 형태: single=단일 이미지 / carousel=카드뉴스(N슬라이드) */
export type CampaignFormat = "single" | "carousel";

/** 안내문 정보 슬롯 — offer 스키마(설득 전제)와 분리된 정보 전달용 구조. */
export interface NoticeMeta {
  /** 1~2문장 요약 */
  summary?: string;
  /** 모집/정원 (예: "30명 선착순") */
  capacity?: string;
  /** 신청 경로 URL (구글폼 등) */
  applyUrl?: string;
  /** 상세 공지 URL */
  noticeUrl?: string;
  /** 대상/자격 조건 */
  eligibility?: string;
  /** 마감/일정 조건 */
  deadline?: string;
  /** 신청 시 기입 요청 항목 */
  requestFields?: string[];
}

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
  automation_level: AutomationLevel;
  key_visual_intent: string | null;
  selected_key_visual_ids: string[];
  content_mode: ContentMode;
  raw_content: string | null;
  notice_meta: NoticeMeta | null;
  tone_override: string | null;
  format: CampaignFormat;
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
  // Multi-material run 메타 (migration 022)
  label: string | null;
  parent_run_id: string | null;
  iteration_index: number | null;
  archived_at: string | null;
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

export type BatchMode = "replace" | "add" | "remix" | "legacy";

export interface CreativeVariant {
  id: string;
  stage_id: string;
  label: string;
  content_json: Record<string, unknown>;
  scores_json: Record<string, unknown>;
  prompt_version: string | null;
  selected: boolean;
  created_at: string;
  batch_id: string;
  batch_index: number;
  batch_mode: BatchMode;
  batch_instruction: string | null;
  base_variant_id: string | null;
  archived_at: string | null;
}

export interface BatchSummary {
  batch_id: string;
  batch_index: number;
  batch_mode: BatchMode;
  batch_instruction: string | null;
  created_at: string;
  variant_count: number;
  archived: boolean;
}

export interface CampaignIntent {
  name: string;
  goal: CampaignGoal;
  offer_id: string | null;
  audience_id: string | null;
  channel: string;
  constraints?: Record<string, unknown>;
  automation_level?: AutomationLevel;
  key_visual_intent?: string | null;
  selected_key_visual_ids?: string[];
  content_mode?: ContentMode;
  raw_content?: string | null;
  notice_meta?: NoticeMeta | null;
  tone_override?: string | null;
  format?: CampaignFormat;
}
