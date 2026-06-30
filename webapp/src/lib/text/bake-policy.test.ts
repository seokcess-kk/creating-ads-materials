import { describe, it, expect } from "vitest";
import { needsOverlayText, anyNeedsOverlay } from "./bake-policy";

describe("needsOverlayText", () => {
  it("짧고 또렷한 후킹 헤드라인은 굽기 허용(false)", () => {
    expect(needsOverlayText("하루 5분 영어 공부법")).toBe(false); // 단일 숫자+분(시각 아님)
    expect(needsOverlayText("3가지 비법")).toBe(false);
    expect(needsOverlayText("지금 신청하세요")).toBe(false);
    expect(needsOverlayText("가을 신메뉴")).toBe(false);
  });

  it("정확히 보존돼야 하는 데이터는 후합성 필요(true)", () => {
    expect(needsOverlayText("11월 15일 마감")).toBe(true); // 날짜
    expect(needsOverlayText("오후 2시 30분")).toBe(true); // 시각
    expect(needsOverlayText("참가비 3만원")).toBe(true); // 금액
    expect(needsOverlayText("50% 할인")).toBe(true); // 퍼센트
    expect(needsOverlayText("문의 02-123-4567")).toBe(true); // 전화(3자리+)
    expect(needsOverlayText("선착순 1,000명")).toBe(true); // 3자리+ 숫자
    expect(needsOverlayText("2026년 신학기")).toBe(true); // 연도
    expect(needsOverlayText("https://glitzy.kr 방문")).toBe(true); // URL
  });

  it("한 블록에 굽기엔 긴 문장(글자 벽)은 후합성 필요(true)", () => {
    expect(
      needsOverlayText(
        "하루에 단 5분만 투자하면 누구나 쉽게 영어 실력을 빠르게 향상시킬 수 있습니다",
      ),
    ).toBe(true);
  });

  it("빈 값은 false", () => {
    expect(needsOverlayText("")).toBe(false);
    expect(needsOverlayText(null)).toBe(false);
    expect(needsOverlayText(undefined)).toBe(false);
    expect(needsOverlayText("   ")).toBe(false);
  });
});

describe("anyNeedsOverlay", () => {
  it("하나라도 후합성 필요면 true", () => {
    expect(anyNeedsOverlay("가을 신메뉴", "9월 한정 50% 할인", null)).toBe(true);
    expect(anyNeedsOverlay("가을 신메뉴", "신상 출시", "자세히 보기")).toBe(false);
  });
});
