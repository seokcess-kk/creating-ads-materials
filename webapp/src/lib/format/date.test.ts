import { describe, expect, it } from "vitest";
import { formatKst } from "./date";

describe("formatKst", () => {
  it("UTC input을 KST로 변환해 포맷한다", () => {
    // 2026-01-01T00:00:00Z == KST 2026-01-01 09:00:00
    const out = formatKst("2026-01-01T00:00:00Z");
    expect(out).toContain("2026");
    expect(out).toContain("01");
    expect(out).toMatch(/09/);
  });

  it("string/number/Date 모두 받는다", () => {
    const d = new Date("2026-03-15T12:34:56Z");
    const a = formatKst(d);
    const b = formatKst(d.toISOString());
    const c = formatKst(d.getTime());
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("옵션으로 표시 항목을 제한할 수 있다", () => {
    const out = formatKst("2026-01-01T00:00:00Z", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    expect(out).not.toMatch(/\d{2}:\d{2}/);
    expect(out).toContain("2026");
  });
});
