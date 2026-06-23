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
