// API usage operation 라벨 단일 소스.
// record.ts 호출부에서 쓰는 operation 키와 1:1로 맞춘다. 신규 operation을 추가할 때
// 여기에 함께 등록하면 사용량 화면이 raw snake_case로 깨지지 않는다.
export const OPERATION_LABELS: Record<string, string> = {
  strategy: "Strategy 생성",
  copy: "Copy 생성",
  offer_draft_generate: "Offer 초안 생성",
  visual_gen: "Visual 생성",
  visual_gen_asset: "Visual 생성 (에셋)",
  visual_validator_batch: "Visual 검증",
  retouch: "Retouch 편집",
  analyze_website: "홈페이지 분석",
  vision_bp: "BP 분석",
  vision_bp_reanalyze: "BP 재분석",
  vision_bp_promote: "자사 BP 승격 분석",
  vision_bp_import_url: "BP 분석 (URL)",
  vision_key_visual: "Key Visual 분석",
  bp_embed: "BP 임베딩",
  bp_embed_backfill: "BP 임베딩 (백필)",
  bp_embed_import_url: "BP 임베딩 (URL)",
  bp_embed_promote: "BP 임베딩 (승격)",
  bp_embed_reanalyze: "BP 임베딩 (재분석)",
  bp_retrieve_strategy: "BP 검색 (Strategy)",
  bp_retrieve_copy: "BP 검색 (Copy)",
};

export function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation;
}
