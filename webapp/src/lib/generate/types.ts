import type { AspectRatio } from "@/lib/engines";

/** overlay = 텍스트 없는 배경 + 컴포지터 한글 오버레이 / full = 이미지에 텍스트까지 베이킹 */
export type SingleRenderMode = "overlay" | "full";

/**
 * 소재 용도 — CTA 처리 방식을 결정한다.
 *  - ad(기본): 유료 광고 지면(인스타·메타 등)은 매체가 네이티브 CTA 버튼을 제공
 *    → 이미지에 CTA를 넣지 않는다(눌리지 않는 '가짜 버튼' 방지).
 *  - organic: 게시물·카톡·출력물 등 버튼 없는 지면 → CTA를 이미지에 합성.
 */
export type Placement = "ad" | "organic";
export type VariantMode = SingleRenderMode | "edit";

/**
 * 레퍼런스 반영 강도:
 *  - mood: 텍스트 요약(DesignReference)만 프롬프트에 주입 — 픽셀은 모델에 전달하지 않음(가장 느슨)
 *  - style: 레퍼런스 픽셀을 editImage로 직접 참조 — 색·조명·무드·구도를 강하게 따라가되 장면·피사체는 새로
 *  - layout: 레퍼런스를 디자인 템플릿처럼 취급 — 배치·타이포 위계·장식 요소까지 유지하고 내용만 교체
 */
export type ReferenceStrength = "mood" | "style" | "layout";

/** @deprecated 구 style/base 토글. referenceStrength로 대체(base → layout, style → style 매핑). */
export type ReferenceMode = "style" | "base";

/** 카피(텍스트)가 들어갈 세로 위치 — overlay 컴포지터 텍스트존 + 프롬프트 여백 위치를 함께 결정. */
export type CopyPosition = "top" | "center" | "bottom";

/** 레퍼런스 타이포 카테고리 — 설치 폰트 매핑용(실제 폰트 파일은 추출 불가). */
export type ReferenceFontCategory =
  | "sans"
  | "serif"
  | "rounded"
  | "display"
  | "handwriting";

/** 서버에 설치되어 결정적으로 렌더할 수 있는 한글 폰트 패밀리. */
export type ReferenceFontFamily =
  | "pretendard"
  | "suit"
  | "spoqa-han-sans-neo"
  | "scdream"
  | "gmarket-sans"
  | "jalnan-gothic"
  | "jalnan2"
  | "nanum-square-round"
  | "nanum-myeongjo"
  | "nanum-barunpen"
  | "cafe24-danjunghae";

/** 레퍼런스에서 측정한 타이포 레이아웃. 비율은 캔버스 너비/높이 기준 0~1. */
export interface ReferenceTypographyProfile {
  alignment: "left" | "center" | "right";
  headlineSizeRatio: number;
  headlineYRatio: number;
  headlineMaxWidthRatio: number;
  headlineLineHeight: number;
  headlineColor: string;
  headlineWeight: "regular" | "medium" | "bold" | "black";
  subSizeRatio?: number;
  subYRatio?: number;
  subMaxWidthRatio?: number;
  subColor?: string;
  hasStrokeOrShadow?: boolean;
}

export type ReferenceTextRole =
  | "eyebrow"
  | "headline"
  | "price"
  | "sub"
  | "badge"
  | "legal"
  | "footer";

/** 레퍼런스 광고의 텍스트 블록 하나. 좌표와 크기는 원본 캔버스 기준 0~1. */
export interface ReferenceTextLayer {
  role: ReferenceTextRole;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  sizeRatio: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  color: string;
  gradientEndColor?: string;
  weight: "regular" | "medium" | "bold" | "black";
  maxLines: number;
  strokeColor?: string;
  backgroundColor?: string;
  cornerRadiusRatio?: number;
}

/** 레퍼런스 비전 분석 결과 — 디자인 요소 추출. */
export interface DesignReference {
  /** 분석 스키마 버전. v2부터 의미 기반 textLayers를 지원한다. */
  analysisVersion?: 2;
  palette: string[];
  mood: string;
  composition: string;
  layout: string;
  typographyVibe: string;
  /** 타이포 카테고리(선택) — 캐러셀이 설치 폰트로 매핑할 때 사용. */
  fontCategory?: ReferenceFontCategory;
  /** 설치 폰트 중 시각적으로 가장 가까운 패밀리. 사용자가 UI에서 보정할 수 있다. */
  fontFamily?: ReferenceFontFamily;
  /** 글자 배치와 비례를 후합성에서도 최대한 재현하기 위한 구조화 측정값. */
  typography?: ReferenceTypographyProfile;
  /** 단일 headline/sub로 평탄화하지 않은 광고 레이어 구조. */
  textLayers?: ReferenceTextLayer[];
  notes?: string;
}

export type CopyAngle =
  | "benefit"
  | "curiosity"
  | "urgency"
  | "social_proof"
  | "emotional";

/** 카피 자동작성 1벌. */
export interface CopyOption {
  headline: string;
  sub?: string;
  cta?: string;
  angle: CopyAngle;
}

/** 단일 이미지 생성 요청 입력. keyMessage(알릴 핵심)만 필수, 나머지는 선택. */
export interface SingleImageInput {
  /** 알리려는 핵심 메시지/혜택 — 필수 1차 입력(카피·아트디렉터 의도를 주도) */
  keyMessage: string;
  /** 비주얼·장면(선택) — 레퍼런스 첨부 시 자동 채움. 없으면 메시지+레퍼런스로 아트디렉터가 구성 */
  concept?: string | null;
  headline?: string | null;
  sub?: string | null;
  cta?: string | null;
  tone?: string | null;
  /** 구조화 스타일 노브(선택) — UI 프리셋 칩에서 영어 구문으로 매핑되어 들어온다. */
  lighting?: string | null;
  palette?: string | null;
  mood?: string | null;
  /** 카피 세로 위치(선택) — overlay에서 텍스트존·여백 위치를 결정. */
  copyPosition?: CopyPosition | null;
  /** 소재 용도(기본 ad) — ad면 CTA를 이미지에 넣지 않는다(매체 버튼이 대신). */
  placement?: Placement;
  aspectRatio?: AspectRatio;
  referenceImageUrl?: string | null;
  /** 레퍼런스 반영 강도(기본 style). 미지정 시 구 referenceMode에서 매핑. */
  referenceStrength?: ReferenceStrength;
  /** @deprecated referenceStrength로 대체 — 구 클라이언트 호환용으로만 수용. */
  referenceMode?: ReferenceMode;
  /** 업로드 직후 이미 추출한 디자인 요소(있으면 생성 시 비전 재분석 생략) */
  designRef?: DesignReference | null;
  brandId?: string | null;
  renderMode?: SingleRenderMode;
  count?: number;
}

export interface GeneratedImageVariant {
  label: string;
  url: string;
  path: string;
  mode: VariantMode;
  /** overlay 모드 재합성용 텍스트 없는 배경 URL(없으면 재합성 불가) */
  bgUrl?: string | null;
  /** image_variants.meta_json에 저장할 추적 정보(prompt/provider/model/size/compose 등) */
  meta?: Record<string, unknown>;
}

export interface SingleImageResult {
  variants: GeneratedImageVariant[];
  failures: Array<{ label: string; reason: string }>;
}

export interface ImageGenerationRow {
  id: string;
  owner_id: string;
  brand_id: string | null;
  input_json: Record<string, unknown>;
  status: "pending" | "ready" | "failed";
  error: string | null;
  prompt_version: string | null;
  created_at: string;
}

export interface ImageVariantRow {
  id: string;
  generation_id: string;
  url: string;
  storage_path: string;
  label: string | null;
  selected: boolean;
  /** overlay 후보의 재합성용 배경 URL(027 마이그레이션). null이면 재합성 불가. */
  bg_url: string | null;
  meta_json: Record<string, unknown>;
  created_at: string;
}
