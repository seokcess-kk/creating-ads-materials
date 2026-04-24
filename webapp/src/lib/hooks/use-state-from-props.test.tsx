import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStateFromProps } from "./use-state-from-props";

describe("useStateFromProps", () => {
  it("mount 시 initial 값을 그대로 반환", () => {
    const { result } = renderHook(({ initial }) => useStateFromProps(initial), {
      initialProps: { initial: 1 },
    });
    expect(result.current[0]).toBe(1);
  });

  it("로컬 setState 호출 후에도 값이 유지된다", () => {
    const { result } = renderHook(({ initial }) => useStateFromProps(initial), {
      initialProps: { initial: 1 },
    });
    act(() => {
      result.current[1](99);
    });
    expect(result.current[0]).toBe(99);
  });

  it("initial 값이 바뀌면 상태가 새 initial로 리셋된다", () => {
    const { result, rerender } = renderHook(
      ({ initial }) => useStateFromProps(initial),
      { initialProps: { initial: "a" } },
    );
    act(() => {
      result.current[1]("local-edit");
    });
    expect(result.current[0]).toBe("local-edit");

    rerender({ initial: "b" });
    expect(result.current[0]).toBe("b");
  });

  it("initial 값이 같으면(Object.is) 로컬 상태를 덮어쓰지 않는다", () => {
    const { result, rerender } = renderHook(
      ({ initial }) => useStateFromProps(initial),
      { initialProps: { initial: "a" } },
    );
    act(() => {
      result.current[1]("local-edit");
    });

    rerender({ initial: "a" });
    expect(result.current[0]).toBe("local-edit");
  });

  it("객체 참조는 Object.is로 판별되어 같은 참조면 유지", () => {
    const obj = { id: 1 };
    const { result, rerender } = renderHook(
      ({ initial }: { initial: { id: number } }) => useStateFromProps(initial),
      { initialProps: { initial: obj } },
    );
    const nextLocal = { id: 2 };
    act(() => {
      result.current[1](nextLocal);
    });
    expect(result.current[0]).toBe(nextLocal);

    rerender({ initial: obj });
    expect(result.current[0]).toBe(nextLocal);
  });

  it("함수형 setState도 동작한다", () => {
    const { result } = renderHook(({ initial }) => useStateFromProps(initial), {
      initialProps: { initial: 10 },
    });
    act(() => {
      result.current[1]((prev) => prev + 5);
    });
    expect(result.current[0]).toBe(15);
  });
});
