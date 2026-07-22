import { describe, expect, it } from "vitest";
import { normalizeDesignReference, ReferenceDraftSchema } from "./analyze-reference";
import { assertCopyFitsTypography, singleAdConfig } from "./render";

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
});
