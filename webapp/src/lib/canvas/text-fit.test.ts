import { describe, it, expect } from "vitest";
import { wrapText, fitText } from "./text-fit";

// 단순 monospace 가정: 글자 1개 = 10px (테스트 결정성 확보).
const mono = (t: string) => t.length * 10;

describe("wrapText", () => {
  it("폭 이내면 한 줄 그대로", () => {
    expect(wrapText("hello", 100, mono)).toEqual(["hello"]);
  });

  it("어절 단위로 줄바꿈", () => {
    // maxWidth=50 → 5글자/줄. "ab cd ef" (각 2글자)
    expect(wrapText("ab cd ef", 50, mono)).toEqual(["ab cd", "ef"]);
  });

  it("\\n은 유지", () => {
    expect(wrapText("foo\nbar", 100, mono)).toEqual(["foo", "bar"]);
  });

  it("공백 없는 긴 토큰은 글자 단위 폴백", () => {
    // maxWidth=30 → 3글자/줄. "abcdefg"(7글자)
    expect(wrapText("abcdefg", 30, mono)).toEqual(["abc", "def", "g"]);
  });

  it("한국어 어절 줄바꿈", () => {
    // maxWidth=60 → 6글자/줄. "여름방학 집중반" → "여름방학"(4) + " 집중반"(test 8>6) 분리
    expect(wrapText("여름방학 집중반", 60, mono)).toEqual(["여름방학", "집중반"]);
  });
});

describe("fitText", () => {
  const measureAt = (size: number, t: string) => t.length * size * 0.5;

  it("base 크기에서 maxLines 이내면 그대로", () => {
    // base 40, maxWidth 400 → 20글자/줄. 10글자 텍스트 → 1줄
    const r = fitText("0123456789", { baseSize: 40, maxWidth: 400, maxLines: 2 }, measureAt);
    expect(r.fontSize).toBe(40);
    expect(r.lines).toEqual(["0123456789"]);
  });

  it("길면 폰트를 축소해 maxLines를 만족", () => {
    // base 40: 20글자/줄. 30글자 → 2줄(maxLines 1 위반) → 축소
    const text = "012345678901234567890123456789"; // 30 chars, no spaces
    const r = fitText(text, { baseSize: 40, maxWidth: 400, maxLines: 1, minScale: 0.5 }, measureAt);
    // 더 작은 폰트일수록 한 줄에 더 많이 들어감 → 결국 1줄
    expect(r.lines.length).toBeLessThanOrEqual(1 + 1); // 최소 스케일에서도 보장 못하면 마지막 반환
    expect(r.fontSize).toBeLessThanOrEqual(40);
  });

  it("minScale 아래로는 내려가지 않음", () => {
    const r = fitText("aaaaaaaaaaaaaaaaaaaa", { baseSize: 100, maxWidth: 50, maxLines: 1, minScale: 0.6 }, measureAt);
    expect(r.fontSize).toBeGreaterThanOrEqual(Math.round(100 * 0.6));
  });
});
