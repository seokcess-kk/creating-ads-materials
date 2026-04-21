"use client";

import Link from "next/link";
import { useNotifications } from "./NotificationContext";

export function CompletionBanner() {
  const { completed, dismissed, dismissCompleted } = useNotifications();

  const visible = completed.filter(
    (op) => op.celebrate !== false && !dismissed.has(op.id),
  );
  if (visible.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 space-y-1 px-6 pt-2">
      {visible.slice(0, 3).map((op) => {
        const isFailed = op.status === "failed";
        const icon = isFailed ? "❌" : "✅";
        const bg = isFailed
          ? "bg-destructive/10 border-destructive/40"
          : "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800";

        return (
          <div
            key={op.id}
            className={`max-w-6xl mx-auto border rounded-md px-4 py-2.5 flex items-center gap-3 shadow-sm ${bg}`}
            role="status"
          >
            <span className="text-base shrink-0" aria-hidden>
              {icon}
            </span>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium">
                {op.title} {isFailed ? "실패" : "완료"}
              </p>
              {isFailed && op.errorMsg ? (
                <p className="text-xs text-destructive line-clamp-1">{op.errorMsg}</p>
              ) : op.subtitle ? (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {op.subtitle}
                </p>
              ) : null}
            </div>
            {op.href && (
              <Link
                href={op.href}
                onClick={() => dismissCompleted(op.id)}
                className="text-xs font-medium hover:underline shrink-0"
              >
                보러가기 →
              </Link>
            )}
            <button
              type="button"
              onClick={() => dismissCompleted(op.id)}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
