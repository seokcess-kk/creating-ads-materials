import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { findBusyCopyZones } from "./quality";

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
