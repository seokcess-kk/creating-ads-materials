import { describe, it, expect } from "vitest";
import { buildEditInstruction } from "./edit-variant";

describe("buildEditInstruction", () => {
  it("localize: 'Replace A with B' + 디자인 보존절", () => {
    const s = buildEditInstruction({
      sourceUrl: "x",
      op: "localize",
      from: "안녕하세요",
      to: "HELLO",
    });
    expect(s).toContain('Replace the text "안녕하세요" with "HELLO"');
    expect(s.toLowerCase()).toContain("exactly the same");
    expect(s.toLowerCase()).toContain("only the wording changes");
  });

  it("recolor/background/add/remove 모두 'change nothing else' 보존절 포함", () => {
    const ops = ["recolor", "background", "add", "remove"] as const;
    for (const op of ops) {
      const s = buildEditInstruction({
        sourceUrl: "x",
        op,
        target: "배경",
        color: "deep navy",
        scene: "a warm cafe window",
        element: "a small orange cat",
        position: "bottom left",
      });
      expect(s.toLowerCase()).toContain("change nothing else");
    }
  });

  it("recolor는 'Change ONLY'로 대상을 한정한다", () => {
    const s = buildEditInstruction({ sourceUrl: "x", op: "recolor", target: "the button", color: "black" });
    expect(s).toContain("Change ONLY the button to black");
  });
});
