// 상태 enum의 사용자 표시 라벨 단일 소스. DB enum 원문(draft/visual/complete 등)이
// 여러 화면에 그대로 노출되지 않도록 여기서만 매핑한다.
import type { CampaignStatus, RunStatus, CreativeStageName } from "./types";

const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "초안",
  running: "진행 중",
  completed: "완료",
  abandoned: "중단",
};

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  pending: "대기",
  strategy: "전략",
  copy: "카피",
  visual: "비주얼",
  retouch: "리터치",
  compose: "합성",
  ship: "출고 대기",
  complete: "완료",
  failed: "실패",
};

const STAGE_LABELS: Record<CreativeStageName, string> = {
  strategy: "Strategy",
  copy: "Copy",
  visual: "Visual",
  retouch: "Retouch",
  compose: "Compose",
  ship: "Ship",
};

export function campaignStatusLabel(status: string): string {
  return CAMPAIGN_STATUS_LABELS[status as CampaignStatus] ?? status;
}

export function runStatusLabel(status: string): string {
  return RUN_STATUS_LABELS[status as RunStatus] ?? status;
}

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as CreativeStageName] ?? stage;
}
