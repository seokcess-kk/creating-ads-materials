import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  DesignReferenceSchema,
  extractPixelPalette,
  formatDesignReference,
  normalizeDesignReference,
} from "./analyze-reference";
import { assertCopyFitsTypography, buildReferenceTextLayers, singleAdConfig } from "./render";
import { copyLimitsForTypography, countCopyChars, layerCopySpecs } from "./copy-limits";

const typography = {
  alignment: "right" as const,
  headlineSizeRatio: 0.11,
  headlineYRatio: 0.24,
  headlineMaxWidthRatio: 0.62,
  headlineLineHeight: 1.05,
  headlineColor: "#112233",
  headlineWeight: "black" as const,
  subSizeRatio: 0.025,
  subYRatio: 0.43,
  subMaxWidthRatio: 0.55,
  subColor: "#445566",
  hasStrokeOrShadow: false,
};

describe("reference typography", () => {
  it("keeps font category and measured typography from the analysis", () => {
    const parsed = DesignReferenceSchema.parse({
      palette: ["#112233"],
      mood: "calm",
      composition: "right aligned",
      layout: "editorial",
      typographyVibe: "heavy condensed display",
      fontCategory: "display",
      typography,
      textLayersMeasured: true,
    });

    expect(parsed.fontCategory).toBe("display");
    expect(parsed.typography?.headlineYRatio).toBe(0.24);
    expect(parsed.textLayersMeasured).toBe(true);
  });

  it("keeps analysis usable when optional font measurements are omitted", () => {
    const normalized = normalizeDesignReference({
      palette: ["#FFFFFF"],
      mood: "clean",
      composition: "centered",
      layout: "simple",
      typographyVibe: "bold condensed poster title",
    });

    expect(normalized.fontCategory).toBe("display");
    expect(normalized.fontFamily).toBe("gmarket-sans");
  });

  it("applies measured geometry, color, alignment and weight to overlay copy", () => {
    const config = singleAdConfig({ headline: "헤드라인", sub: "설명", typography });

    expect(config.mainCopy).toMatchObject({
      align: "right",
      xRatio: 0.95,
      sizeRatio: 0.11,
      yRatio: 0.24,
      maxWidthRatio: 0.62,
      lineSpacingRatio: 0.1155,
      color: "#112233",
      fontWeight: "900",
      stroke: false,
    });
    expect(config.subCopy).toMatchObject({
      align: "right",
      xRatio: 0.95,
      sizeRatio: 0.025,
      yRatio: 0.43,
      maxWidthRatio: 0.55,
      color: "#445566",
      stroke: false,
    });
  });

  it("rejects copy that would destroy the reference hierarchy", () => {
    expect(() =>
      assertCopyFitsTypography({
        headline: "아주긴헤드라인문구를계속입력해서레이아웃영역을넘치게만듭니다",
        typography: { ...typography, headlineMaxWidthRatio: 0.3 },
      }),
    ).toThrow(/이내로 줄여 주세요/);
  });

  it("splits a price into an independent styled advertising layer", () => {
    const layers = buildReferenceTextLayers({
      headline: "오스템 임플란트 35만원",
      sub: "국산정품 지르코니아",
      layers: [
        { role: "headline", xRatio: 0.06, yRatio: 0.35, widthRatio: 0.55, sizeRatio: 0.08, lineHeight: 1.05, align: "left", color: "#FFFFFF", weight: "black", maxLines: 2 },
        { role: "price", xRatio: 0.06, yRatio: 0.58, widthRatio: 0.48, sizeRatio: 0.15, lineHeight: 1, align: "left", color: "#FFD700", gradientEndColor: "#00E5FF", weight: "black", maxLines: 1 },
        { role: "sub", xRatio: 0.06, yRatio: 0.7, widthRatio: 0.55, sizeRatio: 0.03, lineHeight: 1.2, align: "left", color: "#FFFFFF", weight: "regular", maxLines: 2 },
      ],
    });

    expect(layers.map((layer) => [layer.text, layer.color])).toEqual([
      ["오스템 임플란트", "#FFFFFF"],
      ["35만원", "#FFD700"],
      ["국산정품 지르코니아", "#FFFFFF"],
    ]);
    const config = singleAdConfig({ headline: "오스템 임플란트 35만원", textLayers: [
      { role: "headline", xRatio: 0.06, yRatio: 0.35, widthRatio: 0.55, sizeRatio: 0.08, lineHeight: 1.05, align: "left", color: "#FFFFFF", weight: "black", maxLines: 2 },
      { role: "price", xRatio: 0.06, yRatio: 0.58, widthRatio: 0.48, sizeRatio: 0.15, lineHeight: 1, align: "left", color: "#FFD700", weight: "black", maxLines: 1 },
    ] });
    expect(config.mainCopy).toBeUndefined();
    expect(config.textLayers).toHaveLength(2);
  });

  it("clamps imperfect vision measurements instead of discarding the analysis", () => {
    const parsed = DesignReferenceSchema.parse({
      palette: Array.from({ length: 10 }, (_, i) => `#00000${i}`),
      mood: "m".repeat(240),
      composition: "center",
      layout: "dense",
      typographyVibe: "display",
      textLayers: [{
        role: "headline",
        xRatio: -0.03,
        yRatio: 1.06,
        widthRatio: 1.2,
        sizeRatio: 0.42,
        lineHeight: 2.4,
        align: "left",
        color: "#FFFFFF",
        weight: "black",
        maxLines: 5,
      }],
    });

    expect(parsed.palette).toHaveLength(8);
    expect(parsed.mood).toHaveLength(200);
    expect(parsed.textLayers?.[0]).toMatchObject({
      xRatio: 0,
      yRatio: 1,
      widthRatio: 1,
      sizeRatio: 0.35,
      lineHeight: 2,
      maxLines: 4,
    });
  });

  it("extracts dominant colors from pixels without relying on model prose", async () => {
    const raw = Buffer.alloc(40 * 20 * 3);
    for (let i = 0; i < 40 * 20; i++) {
      const color = i < 40 * 15 ? [20, 100, 245] : [45, 240, 145];
      raw.set(color, i * 3);
    }
    const image = await sharp(raw, { raw: { width: 40, height: 20, channels: 3 } }).png().toBuffer();
    const palette = await extractPixelPalette(image, 2);
    expect(palette).toHaveLength(2);
    expect(palette[0]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("exposes the same copy limits to client and server from one formula", () => {
    const limits = copyLimitsForTypography(typography);
    expect(limits.headline).toBeGreaterThan(0);
    expect(limits.sub).toBeGreaterThan(0);
    expect(countCopyChars(" 시그니처 라떼 ")).toBe(6);
    // 서버 assert도 같은 공식을 쓰므로 한도 이내 카피는 통과한다.
    expect(() =>
      assertCopyFitsTypography({ headline: "가".repeat(limits.headline), typography }),
    ).not.toThrow();
    expect(() =>
      assertCopyFitsTypography({ headline: "가".repeat(limits.headline + 1), typography }),
    ).toThrow(/이내로 줄여 주세요/);
  });

  it("injects layer geometry into prompts only when layers were measured", () => {
    const base = {
      palette: ["#112233"],
      mood: "calm",
      composition: "centered",
      layout: "simple",
      typographyVibe: "sans",
      typography,
      textLayers: [{
        role: "headline" as const,
        xRatio: 0.5, yRatio: 0.3, widthRatio: 0.8, sizeRatio: 0.1,
        lineHeight: 1.1, align: "center" as const, color: "#FFFFFF",
        weight: "black" as const, maxLines: 2,
      }],
    };
    expect(formatDesignReference({ ...base, textLayersMeasured: true }))
      .toContain("text layer geometry");
    expect(formatDesignReference({ ...base, textLayersMeasured: false }))
      .not.toContain("text layer geometry");
    expect(formatDesignReference({ ...base, textLayersMeasured: false }))
      .not.toContain("typography geometry");
  });

  it("fills every measured layer explicitly when role-based layerCopy is provided", () => {
    const layers = [
      { role: "eyebrow" as const, xRatio: 0.06, yRatio: 0.12, widthRatio: 0.6, sizeRatio: 0.04, lineHeight: 1.1, align: "left" as const, color: "#FFFFFF", weight: "medium" as const, maxLines: 1 },
      { role: "headline" as const, xRatio: 0.06, yRatio: 0.3, widthRatio: 0.7, sizeRatio: 0.1, lineHeight: 1.05, align: "left" as const, color: "#FFD600", weight: "black" as const, maxLines: 2 },
      { role: "price" as const, xRatio: 0.06, yRatio: 0.55, widthRatio: 0.6, sizeRatio: 0.14, lineHeight: 1, align: "left" as const, color: "#FFD600", weight: "black" as const, maxLines: 1 },
      { role: "legal" as const, xRatio: 0.5, yRatio: 0.93, widthRatio: 0.85, sizeRatio: 0.018, lineHeight: 1.2, align: "center" as const, color: "#CCCCCC", weight: "regular" as const, maxLines: 1 },
    ];
    const composed = buildReferenceTextLayers({
      layers,
      layerCopy: {
        eyebrow: "겨울 한정",
        headline: "시그니처 라떼 2+1",
        price: "35만원",
        legal: "일부 매장 제외 · 자세한 내용은 매장 문의",
      },
    });

    expect(composed.map((l) => [l.text, l.fontRole])).toEqual([
      ["겨울 한정", "sub"],
      ["시그니처 라떼 2+1", "headline"],
      ["35만원", "headline"],
      ["일부 매장 제외 · 자세한 내용은 매장 문의", "sub"],
    ]);
    // 명시 카피가 있으면 자동 분해(가격 추출)를 거치지 않고 그대로 채운다.
    expect(composed[1].color).toBe("#FFD600");
  });

  it("derives per-role char limits for design-aware copywriting", () => {
    const specs = layerCopySpecs([
      { role: "headline", xRatio: 0.06, yRatio: 0.3, widthRatio: 0.72, sizeRatio: 0.08, lineHeight: 1.05, align: "left", color: "#FFF", weight: "black", maxLines: 2 },
      { role: "legal", xRatio: 0.5, yRatio: 0.93, widthRatio: 0.9, sizeRatio: 0.018, lineHeight: 1.2, align: "center", color: "#CCC", weight: "regular", maxLines: 1 },
    ]);
    expect(specs[0]).toEqual({ role: "headline", maxChars: 20, maxLines: 2 });
    expect(specs[1].maxChars).toBeGreaterThan(specs[0].maxChars / 2);
  });

  it("moves price qualifiers with the price and uses local contrast instead of failing", () => {
    const layers = buildReferenceTextLayers({
      headline: "임플란트 개당 35만원",
      sub: "국산정품 지르코니아",
      busyRoles: ["sub"],
      layers: [
        { role: "headline", xRatio: 0.05, yRatio: 0.28, widthRatio: 0.62, sizeRatio: 0.13, lineHeight: 1.08, align: "left", color: "#FFD600", weight: "black", maxLines: 1 },
        { role: "sub", xRatio: 0.05, yRatio: 0.46, widthRatio: 0.6, sizeRatio: 0.065, lineHeight: 1.15, align: "left", color: "#FFFFFF", weight: "black", maxLines: 2 },
        { role: "price", xRatio: 0.05, yRatio: 0.62, widthRatio: 0.6, sizeRatio: 0.09, lineHeight: 1.1, align: "left", color: "#FFD600", weight: "black", maxLines: 1 },
      ],
    });

    expect(layers.find((layer) => layer.text === "임플란트")).toBeTruthy();
    expect(layers.find((layer) => layer.text === "개당35만원")).toBeTruthy();
    expect(layers.find((layer) => layer.text === "국산정품 지르코니아")?.strokeColor)
      .toBe("rgba(0,0,0,0.68)");
  });
});
