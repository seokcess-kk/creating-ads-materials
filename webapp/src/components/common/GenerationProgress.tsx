"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function fmt(sec: number): string {
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}

/**
 * 생성 진행을 화면 안에서 직접 보여주는 막대.
 * - done/total이 주어지면 그 비율(정확)을, 없으면 경과/예상 기반(추정·최대 98%)을 표시.
 * - 경과·예상 시간을 함께 노출하고, 예상 초과 시 안내 문구를 띄운다.
 */
export function GenerationProgress({
  estimatedSeconds,
  label = "생성 중…",
  className,
  done = 0,
  total = 0,
}: {
  estimatedSeconds: number;
  label?: string;
  className?: string;
  done?: number;
  total?: number;
}) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  const countPct = total > 0 ? Math.round((done / total) * 100) : null;
  const timePct = Math.min(98, Math.round((elapsed / estimatedSeconds) * 100));
  // 정확한 개수가 있으면 그대로(0%면 0%), 시간 추정 모드에서만 최소 4% 바닥값을 준다.
  const barWidth = countPct !== null ? countPct : Math.max(4, timePct);
  const overdue = elapsed > estimatedSeconds * 1.3 && (countPct ?? 0) < 100;

  // 전역 TopProgressBar가 같은 op를 aria-live로 안내하므로, 여기서는 라이브 영역으로 만들지 않는다
  // (중복 음성 안내 방지). 시각적 보강 용도.
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-foreground">
          {label}
          {total > 0 && (
            <span className="font-normal text-muted-foreground">
              {" · "}
              {done}/{total} 완성
            </span>
          )}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono tabular-nums",
            overdue ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {fmt(elapsed)} / ~{fmt(estimatedSeconds)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {overdue && (
        <p className="text-[11px] text-muted-foreground">
          예상보다 조금 더 걸리고 있어요. 거의 다 됐습니다…
        </p>
      )}
    </div>
  );
}
