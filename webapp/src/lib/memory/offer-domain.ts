// 브랜드 카테고리별 추천 칩 옵션 + 도메인 적응형 가이드.

export interface DomainOptions {
  benefits: readonly string[];
  urgency: readonly string[];
  evidence: readonly string[];
  titleHint: string;
  uspHint: string;
}

const GENERIC: DomainOptions = {
  benefits: [
    "무료 체험",
    "1:1 상담",
    "할인 혜택",
    "환불 보장",
    "즉시 이용",
    "24시간 지원",
    "모바일 앱",
  ],
  urgency: ["이번 주 한정", "선착순 100명", "한정 수량", "오픈 이벤트"],
  evidence: ["연속 1위", "누적 이용자 N만명", "만족도 95%", "공식 인증"],
  titleHint: "예: 봄 신학기 3개월 패키지",
  uspHint: "차별점 한 줄 (예: 하루 15분으로 영어 실력 2배)",
};

const EDUCATION: DomainOptions = {
  benefits: [
    "원장 직접 관리",
    "정원제·소수정예",
    "교시제 시간관리",
    "출결 실시간 알림",
    "휴대폰 수거",
    "지정석 운영",
    "백색소음 환경",
    "메디컬·최상위권 조교",
    "AI 학습도구",
    "1:1 코칭",
    "주말 운영",
    "공휴일 운영",
  ],
  urgency: [
    "정원 한정 — 대기 등록",
    "신학기 마감",
    "여름방학 모집 중",
    "지정석 마감 임박",
  ],
  evidence: [
    "재원생 추천 재등록률 N%",
    "원장 N년 경력",
    "메디컬 재학 조교",
    "최상위권 출신 강사",
    "재학생 N명",
  ],
  titleHint: "예: 관리형 자습실·여름방학 집중반·N수반",
  uspHint: "예: 주말 12시간·주 7일 의무자습 / 원장이 직접 관리하는 정원제",
};

const ECOMMERCE: DomainOptions = {
  benefits: [
    "당일 발송",
    "무료 배송",
    "30일 무료 반품",
    "묶음 할인",
    "신규 가입 쿠폰",
    "리뷰 적립",
  ],
  urgency: ["오늘만 N% 할인", "재고 N개 남음", "타임 세일", "주말 한정"],
  evidence: ["누적 판매 N만개", "리뷰 N건", "재구매율 N%", "공식 인증"],
  titleHint: "예: 봄맞이 신상 — 면 셔츠",
  uspHint: "차별점 한 줄 (예: 100% 오가닉 코튼, 24시간 출고)",
};

const SAAS: DomainOptions = {
  benefits: [
    "14일 무료 체험",
    "신용카드 등록 불필요",
    "API 제공",
    "팀 협업",
    "SSO·보안",
    "마이그레이션 지원",
  ],
  urgency: ["월말까지 연간 결제 -20%", "베타 한정 가입"],
  evidence: ["누적 도입사 N개", "ROI N배 검증", "ISO 27001", "SOC2 인증"],
  titleHint: "예: 팀을 위한 프로젝트 관리 — 프로 플랜",
  uspHint: "차별점 한 줄 (예: 30초 만에 로드맵을 만드는 유일한 도구)",
};

const FNB: DomainOptions = {
  benefits: [
    "당일 제조·포장",
    "원산지 표기",
    "예약 우선 좌석",
    "테이크아웃 할인",
    "단체 메뉴",
  ],
  urgency: ["이번 주 신메뉴", "주말 예약 마감", "한정 시즌 메뉴"],
  evidence: ["미슐랭 등재", "재방문율 N%", "셰프 N년 경력"],
  titleHint: "예: 시그니처 코스 — 봄 시즌",
  uspHint: "차별점 한 줄 (예: 매일 직접 잡은 신선한 활어회 코스)",
};

const BEAUTY: DomainOptions = {
  benefits: [
    "전문의 진료",
    "1:1 맞춤 케어",
    "수입 정품 제품",
    "사후 관리",
    "회원 멤버십",
  ],
  urgency: ["이번 달 한정 패키지", "오픈 이벤트", "선착순 N명"],
  evidence: ["전문의 N년 경력", "시술 사례 N건", "공식 수입원"],
  titleHint: "예: 스킨 부스터 3회 패키지",
  uspHint: "차별점 한 줄 (예: 통증 없는 더마펜 + 회복 케어 포함)",
};

const FITNESS: DomainOptions = {
  benefits: [
    "PT 1:1 맞춤",
    "체성분 측정",
    "샤워·라커 포함",
    "그룹 클래스",
    "식단 코칭",
  ],
  urgency: ["오픈 멤버 한정", "시즌 등록 마감"],
  evidence: ["트레이너 자격증", "회원 N명", "다이어트 사례 N건"],
  titleHint: "예: 봄 다이어트 12주 PT 패키지",
  uspHint: "차별점 한 줄 (예: 체성분 분석 기반 1:1 맞춤 PT)",
};

const REGISTRY: Record<string, DomainOptions> = {
  education: EDUCATION,
  ecommerce: ECOMMERCE,
  saas: SAAS,
  fnb: FNB,
  beauty: BEAUTY,
  fitness: FITNESS,
};

export function getDomainOptions(category: string | null | undefined): DomainOptions {
  if (!category) return GENERIC;
  return REGISTRY[category.toLowerCase()] ?? GENERIC;
}

export const KNOWN_CATEGORIES = Object.keys(REGISTRY);
