import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { findBusyCopyZones, findLowContrastLayers } from "./quality";

const layer = {
  role: "headline" as const,
  xRatio: 0.1,
  yRatio: 0.45,
  widthRatio: 0.6,
  sizeRatio: 0.1,
  lineHeight: 1.1,
  align: "left" as const,
  color: "#FFFFFF",
  weight: "black" as const,
  maxLines: 2,
};

describe("copy-zone quality gate", () => {
  it("accepts a calm solid copy zone", async () => {
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#123A8C" } }).png().toBuffer();
    await expect(findBusyCopyZones(image, [layer])).resolves.toEqual([]);
  });

  it("rejects high-frequency subject detail inside a copy zone", async () => {
    const raw = Buffer.alloc(256 * 256 * 3);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const value = (x + y) % 2 ? 255 : 0;
        raw.fill(value, (y * 256 + x) * 3, (y * 256 + x) * 3 + 3);
      }
    }
    const image = await sharp(raw, { raw: { width: 256, height: 256, channels: 3 } }).png().toBuffer();
    const violations = await findBusyCopyZones(image, [layer]);
    expect(violations[0]).toMatchObject({ role: "headline" });
  });
});

describe("contrast gate", () => {
  it("flags a layer whose color matches the zone luminance (orange-on-orange)", async () => {
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#F5A623" } }).png().toBuffer();
    const orange = { ...layer, color: "#FFB84D" };
    await expect(findLowContrastLayers(image, [orange])).resolves.toEqual(["headline"]);
  });

  it("passes a layer with strong contrast against its zone", async () => {
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#0F2044" } }).png().toBuffer();
    await expect(findLowContrastLayers(image, [layer])).resolves.toEqual([]);
  });

  it("skips layers that carry their own background pill", async () => {
    const image = await sharp({ create: { width: 256, height: 256, channels: 3, background: "#F5A623" } }).png().toBuffer();
    const pill = { ...layer, color: "#FFB84D", backgroundColor: "#111111" };
    await expect(findLowContrastLayers(image, [pill])).resolves.toEqual([]);
  });
});

describe("layer color refinement", () => {
  it("recovers glyph and pill colors from reference pixels when vision mislabels them", async () => {
    // 틸(#20C0B0) 필 위에 네이비(#102040) 글자 영역을 시뮬레이션 — 비전은 색을 반대로 기록했다고 가정.
    const W = 192;
    const raw = Buffer.alloc(W * W * 3, 0xee);
    const box = { left: 19, right: 134, top: 76, bottom: 100 };
    for (let y = box.top; y < box.bottom; y++) {
      for (let x = box.left; x < box.right; x++) {
        const glyphStripe = y % 4 === 0 || x % 5 === 0; // ~40% 글자 픽셀
        const [r, g, b] = glyphStripe ? [0x10, 0x20, 0x40] : [0x20, 0xc0, 0xb0];
        raw.set([r, g, b], (y * W + x) * 3);
      }
    }
    const image = await sharp(raw, { raw: { width: W, height: W, channels: 3 } }).png().toBuffer();
    const { refineLayerColors } = await import("./analyze-reference");
    const [refined] = await refineLayerColors(image, [{
      role: "badge",
      xRatio: 0.1, yRatio: 0.45, widthRatio: 0.6, sizeRatio: 0.1,
      lineHeight: 1.1, align: "left", color: "#FF00FF", // 오기록
      weight: "bold", maxLines: 1, backgroundColor: "#FFFFFF", // 오기록
    }]);
    // 글자색은 네이비 계열, 필 배경은 틸 계열로 보정되어야 한다.
    expect(refined.color).not.toBe("#FF00FF");
    const glyph = parseInt(refined.color.slice(1), 16);
    expect((glyph >> 16) & 255).toBeLessThan(80); // R 낮음(네이비)
    const bg = parseInt((refined.backgroundColor ?? "#000000").slice(1), 16);
    expect((bg >> 8) & 255).toBeGreaterThan(120); // G 높음(틸)
  });
});
