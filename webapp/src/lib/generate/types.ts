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

/** 단일 이미지 생성 요청 입력. concept만 필수, 나머지는 선택. */
export interface SingleImageInput {
  concept: string;
  /** 이 소재로 알리려는 핵심 메시지/혜택(아트디렉터·카피 품질 향상용) */
  keyMessage?: string | null;
  headline?: string | null;
  sub?: string | null;
  cta?: string | null;
  tone?: string | null;
  aspectRatio?: AspectRatio;
  referenceImageUrl?: string | null;
  referenceMode?: ReferenceMode;
  brandId?: string | null;
  renderMode?: SingleRenderMode;
  count?: number;
}

export interface GeneratedImageVariant {
  label: string;
  url: string;
  path: string;
  mode: VariantMode;
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
  meta_json: Record<string, unknown>;
  created_at: string;
}
