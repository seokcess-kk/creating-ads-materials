import { describe, expect, it } from "vitest";
import {
  ACTIVE_CHANNELS,
  CHANNELS,
  getChannel,
  isActive,
  listActiveChannels,
} from "./channels";

describe("channels", () => {
  it("getChannel returns config for known id", () => {
    const c = getChannel("ig_feed_square");
    expect(c).not.toBeNull();
    expect(c?.aspectRatio).toBe("1:1");
    expect(c?.width).toBe(1080);
    expect(c?.height).toBe(1080);
  });

  it("getChannel returns null for unknown id", () => {
    expect(getChannel("nope")).toBeNull();
    expect(getChannel("")).toBeNull();
  });

  it("isActive reflects ACTIVE_CHANNELS", () => {
    expect(isActive("ig_story")).toBe(true);
    expect(isActive("tiktok")).toBe(true);
    expect(isActive("made_up_channel")).toBe(false);
  });

  it("listActiveChannels returns full configs in order, no nulls", () => {
    const list = listActiveChannels();
    expect(list.length).toBe(ACTIVE_CHANNELS.length);
    expect(list.map((c) => c.id)).toEqual([...ACTIVE_CHANNELS]);
    list.forEach((c) => {
      expect(c).toBeDefined();
      expect(c.width).toBeGreaterThan(0);
      expect(c.height).toBeGreaterThan(0);
    });
  });

  it("width/height string matches size field for every channel", () => {
    for (const c of Object.values(CHANNELS)) {
      expect(c.size).toBe(`${c.width}x${c.height}`);
    }
  });
});
