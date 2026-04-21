import path from "node:path";
import {
  getCampaign,
  getSelectedVariant,
} from "@/lib/campaigns";
import { loadBrandMemory } from "@/lib/memory";
import { resolveFontPairsForCampaign } from "@/lib/memory/fonts";
import { getFont } from "@/lib/fonts/queries";
import type { BrandMemory, FontRole, FontRow } from "@/lib/memory/types";
import type { CopyVariant } from "@/lib/prompts/copy";
import type { CanvasFontEntry, ComposeFontSet, LogoPosition } from "./compositor";
import { summarizeVisualPatterns, type DigestOpts } from "@/lib/vision/digest";

export interface LogoDefaults {
  position: LogoPosition;
  widthRatio: number;
  source: "bp" | "fallback";
}

export interface ComposeSource {
  memory: BrandMemory;
  copy: CopyVariant;
  baseUrl: string;
  baseSource: "retouch" | "visual";
  fontSet: ComposeFontSet;
  logoDefaults: LogoDefaults;
}

export function normalizeLogoPosition(raw: string | null | undefined): LogoPosition | null {
  if (!raw) return null;
  const n = raw.toLowerCase().replace(/[\s_]/g, "-");
  const valid: LogoPosition[] = [
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];
  if ((valid as string[]).includes(n)) return n as LogoPosition;
  const hasTop = n.includes("top");
  const hasBottom = n.includes("bottom");
  const hasLeft = n.includes("left");
  const hasRight = n.includes("right");
  const hasCenter = n.includes("center") || n.includes("middle");
  if (hasTop && hasLeft) return "top-left";
  if (hasTop && hasRight) return "top-right";
  if (hasBottom && hasLeft) return "bottom-left";
  if (hasBottom && hasRight) return "bottom-right";
  if (hasTop) return hasCenter ? "top-center" : "top-left";
  if (hasBottom) return hasCenter ? "bottom-center" : "bottom-left";
  return null;
}

export function computeLogoDefaults(
  memory: BrandMemory,
  opts?: DigestOpts,
): LogoDefaults {
  const summary = summarizeVisualPatterns(memory, opts);
  const bpPosition = normalizeLogoPosition(summary.topLogoPosition);
  const bpSize = summary.avgLogoSizeRatio;
  if (bpPosition || bpSize != null) {
    return {
      position: bpPosition ?? "top-left",
      widthRatio:
        bpSize != null ? Math.max(0.08, Math.min(0.25, bpSize)) : 0.14,
      source: "bp",
    };
  }
  return {
    position: "top-left",
    widthRatio: 0.14,
    source: "fallback",
  };
}

function resolveCanvasFont(font: FontRow): CanvasFontEntry | null {
  const family = `${font.family.replace(/\s+/g, "_")}-${font.weight ?? "Regular"}`;
  const root = process.cwd();
  if (font.tier === "tier1") {
    const rel = font.file_path.startsWith("/") ? font.file_path.slice(1) : font.file_path;
    return { family, fsPath: path.join(root, "public", rel), cssWeight: font.weight ?? undefined };
  }
  if (font.tier === "tier0") {
    return {
      family,
      fsPath: path.join(root, "..", font.file_path),
      cssWeight: font.weight ?? undefined,
    };
  }
  if (font.tier === "tier2" && font.file_path.startsWith("http")) {
    return { family, fsPath: font.file_path, cssWeight: font.weight ?? undefined };
  }
  if (font.tier === "tier3") {
    return { family, fsPath: font.file_path, cssWeight: font.weight ?? undefined };
  }
  return null;
}

export async function buildComposeSource(
  campaignId: string,
  runId: string,
): Promise<ComposeSource> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("캠페인을 찾을 수 없습니다");

  const [copyV, retouchV, visualV] = await Promise.all([
    getSelectedVariant(runId, "copy"),
    getSelectedVariant(runId, "retouch"),
    getSelectedVariant(runId, "visual"),
  ]);
  if (!copyV) throw new Error("선택된 Copy가 없습니다");
  const base = retouchV ?? visualV;
  if (!base) throw new Error("선택된 Visual(또는 Retouch)이 없습니다");

  const memory = await loadBrandMemory(campaign.brand_id);
  if (!memory) throw new Error("브랜드 메모리를 찾을 수 없습니다");

  const baseUrl = (base.content_json as { url?: string }).url;
  if (!baseUrl) throw new Error("base 이미지 URL 없음");

  // 캠페인 오버라이드가 있으면 그것을 우선, 없으면 브랜드 기본.
  const effectivePairs = await resolveFontPairsForCampaign(
    campaign.brand_id,
    campaignId,
  );
  const fontSet: ComposeFontSet = {};
  for (const [role, pair] of Object.entries(effectivePairs) as Array<
    [FontRole, (typeof effectivePairs)[FontRole]]
  >) {
    if (!pair) continue;
    const font = await getFont(pair.font_id);
    if (!font) continue;
    const entry = resolveCanvasFont(font);
    if (entry) fontSet[role] = entry;
  }

  return {
    memory,
    copy: copyV.content_json as unknown as CopyVariant,
    baseUrl,
    baseSource: retouchV ? "retouch" : "visual",
    fontSet,
    logoDefaults: computeLogoDefaults(memory, {
      goal: campaign.goal,
      channel: campaign.channel.split("_")[0],
    }),
  };
}
