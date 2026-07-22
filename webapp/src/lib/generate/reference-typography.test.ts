import { describe, expect, it } from "vitest";
import { normalizeDesignReference, ReferenceDraftSchema } from "./analyze-reference";
import { assertCopyFitsTypography, buildReferenceTextLayers, singleAdConfig } from "./render";

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
  it("keeps font category and measured typography from the upload draft", () => {
    const parsed = ReferenceDraftSchema.parse({
      conceptDraft: "새 광고",
      palette: ["#112233"],
      mood: "calm",
      composition: "right aligned",
      layout: "editorial",
      typographyVibe: "heavy condensed display",
      fontCategory: "display",
      typography,
    });

    expect(parsed.fontCategory).toBe("display");
    expect(parsed.typography?.headlineYRatio).toBe(0.24);
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
