"use client";

import { useEffect, useState } from "react";
import type { OpStep } from "@/components/notifications/NotificationContext";

interface RunningStatusProps {
  label: string;
  startedAt: string | null;
  estimatedSeconds: number;
  steps?: OpStep[];
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function AnimatedDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);
  return <span className="inline-block w-5 text-left">{".".repeat(n)}</span>;
}

export function RunningStatus({
  label,
  startedAt,
  estimatedSeconds,
  steps,
}: RunningStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const start = startedAt ? new Date(startedAt).getTime() : now;
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const pct = Math.min(98, Math.round((elapsed / estimatedSeconds) * 100));
  const overdue = elapsed > estimatedSeconds * 1.3;

  const currentStepIdx = steps
    ? Math.max(
        0,
        steps.findLastIndex((s) => s.atSec <= elapsed),
      )
    : -1;

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-foreground" />
          <span className="font-medium">
            {label}
            <AnimatedDots />
          </span>
        </div>
        <span className="font-mono text-xs shrink-0 text-muted-foreground">
          {formatElapsed(elapsed)} / ~{formatElapsed(estimatedSeconds)}
        </span>
      </div>

      <div className="relative h-1.5 rounded-md bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {steps && steps.length > 0 && (
        <div className="space-y-1 pt-1">
          {steps.map((s, i) => {
            const done = i < currentStepIdx;
            const current = i === currentStepIdx;
            return (
              <div
                key={i}
                className={
                  "flex items-center gap-2 text-xs " +
                  (done
                    ? "text-muted-foreground"
                    : current
                      ? "text-foreground font-medium"
                      : "text-muted-foreground/60")
                }
              >
                <span className="shrink-0 w-4">
                  {done ? "✓" : current ? "◉" : "○"}
                </span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {overdue && (
        <p className="text-xs text-muted-foreground">
          예상보다 오래 걸립니다. 이 탭을 열어두면 완료 시 자동으로 갱신됩니다.
        </p>
      )}
    </div>
  );
}
