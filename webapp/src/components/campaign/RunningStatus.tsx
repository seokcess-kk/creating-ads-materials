"use client";

import { useEffect, useState } from "react";

interface RunningStatusProps {
  label: string;
  startedAt: string | null;
  estimatedSeconds: number;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Running 중 경과 시간 표시 + 자동 새로고침 힌트.
 * 실시간 streaming은 Phase 3+에서. 현재는 1s 타이머 + auto-polling 옵션.
 */
export function RunningStatus({
  label,
  startedAt,
  estimatedSeconds,
}: RunningStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = startedAt ? new Date(startedAt).getTime() : now;
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const pct = Math.min(98, Math.round((elapsed / estimatedSeconds) * 100));
  const overdue = elapsed > estimatedSeconds * 1.3;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={"font-mono " + (overdue ? "text-amber-600" : "text-foreground")}>
          🕐 {formatElapsed(elapsed)} / ~{formatElapsed(estimatedSeconds)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={
            "h-full transition-all duration-500 " +
            (overdue ? "bg-amber-500" : "bg-primary animate-pulse")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      {overdue && (
        <p className="text-xs text-amber-600">
          예상보다 오래 걸립니다. 브라우저를 닫지 마세요 — 완료되면 자동 갱신됩니다.
        </p>
      )}
    </div>
  );
}
