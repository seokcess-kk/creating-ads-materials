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

export type BrandColorRole =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "semantic";

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
