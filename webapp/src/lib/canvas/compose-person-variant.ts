// Phase 2 — Track A (Compositor 기반 Person variant 생성)
// 인물 실사 사진을 **픽셀 단위 보존**한 채로 텍스트·CTA만 오버레이하여
// Visual 단계 variant를 만든다. Gemini 재생성 경로 (Track B)가 얼굴을
// 미묘하게 변형하는 문제를 회피하는 안전판.

import { composeAd } from "./compositor";
import type {
  BrandKeyVisual,
  KeyVisualFocalArea,
} from "@/lib/memory/types";
import type { CopyVariant } from "@/lib/prompts/copy";
import type { VisualVariantSpec } from "@/lib/prompts/visual";

export interface PersonVariantLayout {
  headline: { yRatio: number; center: boolean; sizeRatio: number };
  sub: { yRatio: number; center: boolean; sizeRatio: number };
  cta: { yRatio: number; sizeRatio: number };
  overlay: { top: boolean; bottom: boolean };
}

/**
 * focal_area(얼굴·피사체 영역)를 피해 텍스트 블록을 배치할 zone을 계산.
 * focal이 상단에 있으면 텍스트는 하단에, focal이 하단에 있으면 상단에.
 * focal이 없을 땐 인물은 상단 가정 → 텍스트는 하단 기본값.
 */
function pickSafeZone(
  focal: KeyVisualFocalArea | null,
): "bottom" | "top" {
  if (!focal) return "bottom";
  const focalCenterY = focal.y + focal.h / 2;
  return focalCenterY < 0.5 ? "bottom" : "top";
}

function layoutForSpec(
  spec: VisualVariantSpec,
  focal: KeyVisualFocalArea | null,
): PersonVariantLayout {
  const zone = pickSafeZone(focal);

  // number_focus: 대형 숫자 헤드라인
  // persona_focus: 여백 최소, 미니멀
  // product_focus: 기본 비율
  const isBigNumber = spec.focus === "number_focus";
  const isMinimal = spec.focus === "persona_focus";

  if (zone === "bottom") {
    return {
      headline: {
        yRatio: isMinimal ? 0.72 : 0.66,
        center: true,
        sizeRatio: isBigNumber ? 0.075 : 0.05,
      },
      sub: {
        yRatio: isMinimal ? 0.82 : 0.78,
        center: true,
        sizeRatio: 0.026,
      },
      cta: {
        yRatio: 0.88,
        sizeRatio: 0.028,
      },
      overlay: { top: false, bottom: true },
    };
  }

  // zone === "top"
  return {
    headline: {
      yRatio: isMinimal ? 0.14 : 0.12,
      center: true,
      sizeRatio: isBigNumber ? 0.075 : 0.05,
    },
    sub: {
      yRatio: isMinimal ? 0.24 : 0.22,
      center: true,
      sizeRatio: 0.026,
    },
    cta: {
      yRatio: 0.32,
      sizeRatio: 0.028,
    },
    overlay: { top: true, bottom: false },
  };
}

export interface ComposePersonVariantInput {
  campaignId: string;
  spec: VisualVariantSpec;
  keyVisual: BrandKeyVisual;
  copy: CopyVariant;
}

export interface ComposePersonVariantResult {
  url: string;
  path: string;
  layout: PersonVariantLayout;
}

export async function composePersonVariant(
  input: ComposePersonVariantInput,
): Promise<ComposePersonVariantResult> {
  const { campaignId, spec, keyVisual, copy } = input;
  const layout = layoutForSpec(spec, keyVisual.focal_area);
  const uniq = Date.now().toString(36);
  const path = `${campaignId}/visual/${uniq}_${spec.id}_person.png`;

  const url = await composeAd({
    backgroundImageUrl: keyVisual.storage_url,
    output: { bucket: "generated-images", path },
    overlay: {
      top: layout.overlay.top,
      topOpacity: 180,
      bottom: layout.overlay.bottom,
      bottomOpacity: 220,
    },
    mainCopy: {
      text: copy.headline,
      yRatio: layout.headline.yRatio,
      center: layout.headline.center,
      sizeRatio: layout.headline.sizeRatio,
      color: "#FFFFFF",
    },
    subCopy: {
      text: copy.subCopy,
      yRatio: layout.sub.yRatio,
      center: layout.sub.center,
      sizeRatio: layout.sub.sizeRatio,
      color: "#FFFFFF",
    },
    cta: {
      text: copy.cta,
      yRatio: layout.cta.yRatio,
      sizeRatio: layout.cta.sizeRatio,
      bgColor: "#D4AF37",
      textColor: "#1a1a2e",
    },
  });

  return { url, path, layout };
}
