// 캐러셀 비주얼 템플릿 — 아트디렉터(배경 팔레트)와 컴포지터(텍스트 색·정렬·오버레이)를 함께 구동.
// 모두 딥/다크 배경 + 흰 텍스트 계열(컴포지터가 다크 오버레이만 지원하므로 가독성 안전).
// 라이트 테마는 컴포지터 확장이 필요해 후순위.

export type CarouselTemplateId = "midnight" | "noir" | "vivid";

export interface CarouselTemplate {
  id: CarouselTemplateId;
  /** UI 라벨(한국어) */
  label: string;
  /** AI 선택 근거 + UI 힌트(한국어) */
  description: string;
  /** 아트디렉터 배경 style-lock의 기반 가이드(영어). 딥/다크 유지 = 흰 텍스트 가독성. */
  bgStyle: string;
  /** 텍스트 정렬 */
  align: "center" | "left";
  colors: {
    headline: string;
    body: string;
    kicker: string;
    slogan: string;
    ctaBg: string;
    ctaText: string;
  };
  /** 다크 그라데이션 오버레이 강도(0~255) */
  overlay: { topOpacity: number; bottomOpacity: number };
}

export const CAROUSEL_TEMPLATES: Record<CarouselTemplateId, CarouselTemplate> = {
  midnight: {
    id: "midnight",
    label: "미드나잇",
    description: "신뢰감 있는 차분한 다크 블루 — 정보·공지·B2B에 무난",
    bgStyle:
      "deep navy-to-charcoal cool gradient with subtle geometric line accents; calm, modern, trustworthy; soft cool lighting; quiet uncluttered negative space",
    align: "center",
    colors: {
      headline: "#FFFFFF",
      body: "#D1D5DB",
      kicker: "#E7E9EE",
      slogan: "#C9CDD6",
      ctaBg: "#2563EB",
      ctaText: "#FFFFFF",
    },
    overlay: { topOpacity: 140, bottomOpacity: 205 },
  },
  noir: {
    id: "noir",
    label: "느와르",
    description: "프리미엄·고급 에디토리얼 블랙 & 골드 — 럭셔리·브랜딩",
    bgStyle:
      "near-black warm dark background; refined editorial premium mood; soft warm golden highlights and elegant minimal texture; generous quiet negative space",
    align: "center",
    colors: {
      headline: "#FFFFFF",
      body: "#E5E0D5",
      kicker: "#D4AF37",
      slogan: "#B8A98C",
      ctaBg: "#D4AF37",
      ctaText: "#1A1A1A",
    },
    overlay: { topOpacity: 150, bottomOpacity: 215 },
  },
  vivid: {
    id: "vivid",
    label: "비비드",
    description: "에너지 있고 모던한 비비드 컬러(좌측 정렬) — 프로모션·MZ 타겟",
    bgStyle:
      "rich saturated jewel-tone gradient flowing from deep indigo into violet and magenta; bold, energetic, modern; smooth glowing color blends; clean negative space for text",
    align: "left",
    colors: {
      headline: "#FFFFFF",
      body: "#F0E6FF",
      kicker: "#F9A8D4",
      slogan: "#E9D5FF",
      ctaBg: "#EC4899",
      ctaText: "#FFFFFF",
    },
    overlay: { topOpacity: 130, bottomOpacity: 200 },
  },
};

export const TEMPLATE_IDS = ["midnight", "noir", "vivid"] as const;
export const DEFAULT_TEMPLATE_ID: CarouselTemplateId = "midnight";

/** id로 템플릿 조회(미지정/미상이면 기본값). */
export function getTemplate(id?: string | null): CarouselTemplate {
  if (id && id in CAROUSEL_TEMPLATES) {
    return CAROUSEL_TEMPLATES[id as CarouselTemplateId];
  }
  return CAROUSEL_TEMPLATES[DEFAULT_TEMPLATE_ID];
}
