"use client";

import { useState } from "react";
import Link from "next/link";
import { useNotifications } from "./NotificationContext";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return `${h}시간 전`;
}

export function ActivityCenter() {
  const {
    ops,
    completed,
    dismissed,
    clearAll,
    notificationsEnabled,
    requestBrowserPermission,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const unseen = completed.filter((op) => !dismissed.has(op.id)).length;
  const total = ops.length + unseen;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="알림 센터"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
            {total > 9 ? "9+" : total}
          </span>
        )}
        {ops.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary animate-ping opacity-60" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
        >
          <div className="fixed inset-0 bg-black/20" />
          <div
            className="fixed top-12 right-4 w-80 max-h-[80vh] bg-background border rounded-md shadow-lg overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-semibold">활동</span>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ops.length === 0 && completed.length === 0 && (
                <p className="p-4 text-xs text-muted-foreground text-center">
                  활동 내역이 없습니다
                </p>
              )}

              {ops.length > 0 && (
                <div className="border-b">
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    진행 중 ({ops.length})
                  </p>
                  {ops.map((op) => (
                    <div key={op.id} className="px-3 py-2 hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                        <span className="text-xs font-medium truncate">{op.title}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-3.5 mt-0.5">
                        {timeAgo(op.startedAt)} 시작 · 예상 {op.estimatedSeconds}초
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {completed.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      최근 완료
                    </span>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      비우기
                    </button>
                  </div>
                  {completed.map((op) => {
                    const failed = op.status === "failed";
                    return (
                      <div
                        key={op.id}
                        className="px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
                      >
                        <span className="shrink-0 text-xs">
                          {failed ? "❌" : "✅"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {op.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {op.completedAt ? timeAgo(op.completedAt) : ""}
                            {failed && op.errorMsg && ` · ${op.errorMsg.slice(0, 40)}`}
                          </p>
                        </div>
                        {op.href && !failed && (
                          <Link
                            href={op.href}
                            onClick={() => setOpen(false)}
                            className="text-[10px] text-primary hover:underline shrink-0"
                          >
                            이동
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t p-3 space-y-2">
              {notificationsEnabled ? (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <span>🔔</span> 브라우저 알림 활성화됨
                </p>
              ) : (
                <button
                  type="button"
                  onClick={requestBrowserPermission}
                  className="w-full text-xs text-primary hover:bg-primary/5 rounded px-2 py-1.5 border border-primary/40"
                >
                  🔔 브라우저 푸시 알림 켜기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
