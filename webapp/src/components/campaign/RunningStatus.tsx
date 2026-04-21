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
    <div className="relative overflow-hidden rounded-md border border-primary/40 p-4 space-y-3">
      {/* pulsing ring */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 rounded-md border-2 border-primary/30 animate-pulse" />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-medium">
            {label}
            <AnimatedDots />
          </span>
        </div>
        <span
          className={
            "font-mono text-xs shrink-0 " +
            (overdue ? "text-amber-600" : "text-muted-foreground")
          }
        >
          🕐 {formatElapsed(elapsed)} / ~{formatElapsed(estimatedSeconds)}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={
            "h-full transition-all duration-500 " +
            (overdue ? "bg-amber-500" : "bg-primary")
          }
          style={{ width: `${pct}%` }}
        />
        {/* shimmer */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]"
          style={{ width: "50%" }}
        />
      </div>

      {steps && steps.length > 0 && (
        <div className="relative space-y-1 pt-1">
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
        <p className="relative text-xs text-amber-600">
          예상보다 오래 걸립니다. 브라우저를 닫지 마세요 — 완료되면 자동 갱신됩니다.
        </p>
      )}

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );
}
