import type { DesignReference } from "@/lib/generate/types";

export type SlideRole = "hook" | "point" | "cta";
export type CarouselBgMode = "shared" | "per-slide";
export type CarouselContentMode = "persuasion" | "notice";
export type CarouselStatus =
  | "draft"
  | "concept"
  | "generating"
  | "ready"
  | "failed";
export type SlideEmphasis = "number" | "keyword" | "calm" | "action";

/** 번들 기획 단계의 슬라이드 골격(상세 카피 아님 — 역할/목적만). */
export interface SlidePlanItem {
  index: number;
  role: SlideRole;
  purpose: string;
}

/** 1단계 산출물 — 캐러셀 전체 기획(콘셉트/서사). */
export interface BundleConcept {
  title: string;
  bigIdea: string;
  coreMessage: string;
  target: string;
  tone: string;
  narrativeArc: string;
  slideCount: number;
  slidePlan: SlidePlanItem[];
}

export interface SlideVisual {
  motif: string;
  emphasis: SlideEmphasis;
}

/** 2단계 산출물 — 슬라이드별 상세(카피 + 비주얼 디렉션). */
export interface SlideDetail {
  index: number;
  role: SlideRole;
  kicker?: string;
  headline: string;
  body?: string;
  visual?: SlideVisual;
}

export interface CarouselRow {
  id: string;
  owner_id: string;
  brand_id: string | null;
  title: string;
  raw_content: string;
  tone_override: string | null;
  content_mode: CarouselContentMode;
  bg_mode: CarouselBgMode;
  bg_url: string | null;
  reference_url: string | null;
  reference_json: DesignReference | Record<string, never>;
  concept_json: BundleConcept | Record<string, never>;
  status: CarouselStatus;
  error: string | null;
  prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarouselSlideRow {
  id: string;
  carousel_id: string;
  idx: number;
  role: SlideRole;
  kicker: string | null;
  headline: string;
  body: string | null;
  visual_json: SlideVisual | Record<string, never>;
  bg_url: string | null;
  image_url: string | null;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

/** 캐러셀 생성 요청 입력. */
export interface CarouselInput {
  brandId?: string | null;
  rawContent: string;
  toneOverride?: string | null;
  contentMode?: CarouselContentMode;
  bgMode?: CarouselBgMode;
  title?: string | null;
  /** 레퍼런스 이미지 공개 URL(선택) — 디자인 요소 추출 후 배경 styleLock에 반영 */
  referenceImageUrl?: string | null;
}
