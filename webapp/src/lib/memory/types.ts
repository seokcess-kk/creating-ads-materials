export interface Brand {
  id: string;
  name: string;
  website_url: string | null;
  category: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandVoice {
  tone?: string;
  personality?: string[];
  do?: string[];
  dont?: string[];
}

export type BrandColorRole = "primary" | "secondary" | "accent" | "neutral" | "semantic";

export interface BrandColor {
  role: BrandColorRole;
  hex: string;
  usage?: string;
}

export interface BrandLogo {
  id: string;
  url: string;
  label?: string;
  is_primary?: boolean;
}

export interface BrandIdentity {
  brand_id: string;
  voice_json: BrandVoice;
  taboos: string[];
  colors_json: BrandColor[];
  logos_json: BrandLogo[];
  updated_at: string;
}

export interface BrandOffer {
  id: string;
  brand_id: string;
  title: string;
  usp: string | null;
  price: string | null;
  benefits: string[];
  urgency: string | null;
  evidence: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandAudience {
  id: string;
  brand_id: string;
  persona_name: string;
  demographics: Record<string, unknown>;
  language_level: string | null;
  pains: string[];
  desires: string[];
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type ReferenceSource = "bp_upload" | "own_archive" | "competitor" | "industry";
export type VisionStatus = "pending" | "ready" | "failed";

export interface VisionAnalysis {
  layout?: {
    textZone?: "top" | "center" | "bottom" | "mixed";
    marginRatio?: number;
    hierarchy?: number;
  };
  color?: {
    palette?: string[];
    contrastRatio?: number;
    mood?: string;
  };
  typography?: {
    style?: string;
    sizeRatio?: Record<string, number>;
  };
  hookElement?: {
    type?: string;
    placement?: string;
  };
  copyStructure?: {
    headlineLen?: number;
    hookType?: string;
    framework?: string;
  };
  brandElements?: {
    logoPosition?: string;
    logoSizeRatio?: number;
    ctaStyle?: string;
  };
  channelFit?: Record<string, number>;
  funnelFit?: Record<string, number>;
  notes?: string;
}

export interface BrandReference {
  id: string;
  brand_id: string;
  file_url: string;
  file_name: string | null;
  source_type: ReferenceSource;
  source_note: string | null;
  is_negative: boolean;
  weight: number;
  vision_analysis_json: VisionAnalysis;
  vision_prompt_version: string | null;
  vision_status: VisionStatus;
  vision_error: string | null;
  vision_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandLearnings {
  brand_id: string;
  hook_win_rates_json: Record<string, number>;
  framework_win_rates_json: Record<string, number>;
  visual_patterns_json: Record<string, unknown>;
  anti_patterns_json: Record<string, unknown>;
  computed_at: string;
}

export type FontTier = "tier0" | "tier1" | "tier2" | "tier3";
export type FontRole = "headline" | "sub" | "cta" | "brand" | "slogan";

export interface FontRow {
  id: string;
  family: string;
  weight: string | null;
  style: string;
  file_path: string;
  file_format: string | null;
  tier: FontTier;
  category: string | null;
  tone_tags: string[];
  language_support: string[];
  recommended_roles: string[];
  license_confirmed: boolean;
  license_note: string | null;
  created_at: string;
}

export interface BrandFontPair {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  role: FontRole;
  font_id: string;
  hierarchy_ratio: number;
  created_at: string;
}

export interface BrandMemory {
  brand: Brand;
  identity: BrandIdentity | null;
  offers: BrandOffer[];
  audiences: BrandAudience[];
  references: BrandReference[];
  learnings: BrandLearnings | null;
  fontPairs: BrandFontPair[];
}
