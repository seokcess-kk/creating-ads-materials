import type { AspectRatio } from "@/lib/engines";

/** overlay = 텍스트 없는 배경 + 컴포지터 한글 오버레이 / full = 이미지에 텍스트까지 베이킹 */
export type SingleRenderMode = "overlay" | "full";
export type VariantMode = SingleRenderMode | "edit";

/** 레퍼런스 활용 방식: style = 디자인 요소만 차용(새 이미지) / base = 레퍼런스 자체를 변형 */
export type ReferenceMode = "style" | "base";

/** 레퍼런스 비전 분석 결과 — 디자인 요소 추출. */
export interface DesignReference {
  palette: string[];
  mood: string;
  composition: string;
  layout: string;
  typographyVibe: string;
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
  aspectRatio?: AspectRatio;
  referenceImageUrl?: string | null;
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
