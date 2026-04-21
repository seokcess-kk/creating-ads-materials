// Stepper 공용 타입 + 초기 stage 결정 로직 — Server/Client 양쪽에서 사용하므로
// "use client" 모듈과 분리한다. Server Component에서 호출 가능.

import type { StageStatus } from "@/lib/campaigns/types";

export interface StepDef {
  key: string;
  label: string;
  status: StageStatus | undefined;
  locked: boolean;
  optional?: boolean;
}

export function pickInitialStage(steps: StepDef[]): string {
  const running = steps.find((s) => s.status === "running");
  if (running) return running.key;
  const stale = steps.find((s) => s.status === "stale" && !s.locked);
  if (stale) return stale.key;
  const failed = steps.find((s) => s.status === "failed" && !s.locked);
  if (failed) return failed.key;
  const todo = steps.find(
    (s) => !s.locked && (s.status === undefined || s.status === "pending"),
  );
  if (todo) return todo.key;
  const readys = steps.filter((s) => s.status === "ready");
  if (readys.length > 0) return readys[readys.length - 1].key;
  return steps[0]?.key ?? "strategy";
}
