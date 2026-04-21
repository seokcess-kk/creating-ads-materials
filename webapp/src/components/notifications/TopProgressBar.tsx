"use client";

import { useEffect, useState } from "react";
import { useNotifications } from "./NotificationContext";

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function TopProgressBar() {
  const { ops } = useNotifications();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (ops.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [ops.length]);

  if (ops.length === 0) return null;

  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-2 space-y-1.5">
        {ops.map((op) => {
          const elapsed = Math.max(0, Math.floor((now - op.startedAt) / 1000));
          const pct = Math.min(98, Math.round((elapsed / op.estimatedSeconds) * 100));
          const overdue = elapsed > op.estimatedSeconds * 1.3;
          const currentStep = op.steps
            ? op.steps.findLast((s) => s.atSec <= elapsed) ?? op.steps[0]
            : null;

          return (
            <div
              key={op.id}
              className="flex items-center gap-3 text-xs"
              aria-live="polite"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">
                    {op.title}
                    {currentStep && (
                      <span className="text-muted-foreground font-normal">
                        {" · "}{currentStep.label}
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      "font-mono shrink-0 " +
                      (overdue ? "text-amber-600" : "text-muted-foreground")
                    }
                  >
                    {formatElapsed(elapsed)} / ~{formatElapsed(op.estimatedSeconds)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden mt-1">
                  <div
                    className={
                      "h-full transition-all duration-500 " +
                      (overdue ? "bg-amber-500" : "bg-primary")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
