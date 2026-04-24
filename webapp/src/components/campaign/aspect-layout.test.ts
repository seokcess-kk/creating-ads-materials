import { describe, expect, it } from "vitest";
import {
  aspectClass,
  composeGridCols,
  maxHeightClass,
  previewContainerMaxVh,
  previewLayoutClass,
  retouchTurnCols,
  variantGridCols,
  type ChannelAspectRatio,
} from "./aspect-layout";

const ALL: ChannelAspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

describe("aspect-layout", () => {
  it("aspectClass maps every ratio", () => {
    expect(aspectClass("1:1")).toBe("aspect-square");
    expect(aspectClass("4:5")).toBe("aspect-[4/5]");
    expect(aspectClass("9:16")).toBe("aspect-[9/16]");
    expect(aspectClass("16:9")).toBe("aspect-[16/9]");
  });

  it("undefined falls back to square", () => {
    expect(aspectClass(undefined)).toBe("aspect-square");
  });

  it("every helper returns a non-empty string for every ratio", () => {
    const helpers = [
      aspectClass,
      maxHeightClass,
      variantGridCols,
      composeGridCols,
      retouchTurnCols,
      previewLayoutClass,
      previewContainerMaxVh,
    ];
    for (const ar of [...ALL, undefined] as (ChannelAspectRatio | undefined)[]) {
      for (const fn of helpers) {
        const out = fn(ar);
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
      }
    }
  });

  it("9:16 previewContainerMaxVh is tallest, 16:9 shortest", () => {
    const vh916 = parseInt(previewContainerMaxVh("9:16"));
    const vh169 = parseInt(previewContainerMaxVh("16:9"));
    expect(vh916).toBeGreaterThan(vh169);
  });
});
