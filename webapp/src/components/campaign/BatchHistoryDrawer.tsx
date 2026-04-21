"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { BatchSummary, CreativeStageName } from "@/lib/campaigns/types";

interface BatchHistoryDrawerProps {
  campaignId: string;
  stage: CreativeStageName;
  /** active batch가 바뀔 때 증가 — 이걸 key로 다시 fetch */
  refreshToken: number;
  onRestored: () => void;
}

export function BatchHistoryDrawer({
  campaignId,
  stage,
  refreshToken,
  onRestored,
}: BatchHistoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/batches?stage=${stage}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "조회 실패");
      setBatches(data.batches ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshToken]);

  async function restore(batchId: string) {
    setRestoring(batchId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, batchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "복원 실패");
      toast.success(`배치 #${batches.find((b) => b.batch_id === batchId)?.batch_index ?? ""} 복원`);
      onRestored();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setRestoring(null);
    }
  }

  const archivedCount = batches.filter((b) => b.archived).length;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs"
      >
        📚 히스토리 {archivedCount > 0 && `(${archivedCount})`}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setOpen(false)}
        >
          <div className="fixed inset-0 bg-black/30" />
          <div
            className="relative w-full max-w-md bg-background border-l shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{stage} 배치 히스토리</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {loading && (
                <p className="text-sm text-muted-foreground">불러오는 중...</p>
              )}
              {!loading && batches.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  아직 생성된 배치가 없습니다
                </p>
              )}
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  className={
                    "border rounded-md p-3 " +
                    (b.archived ? "bg-muted/20" : "bg-primary/5 border-primary/40")
                  }
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        #{b.batch_index}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {b.batch_mode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {b.variant_count}개
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("ko", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {b.batch_instruction && (
                    <p className="text-xs text-muted-foreground italic mb-2">
                      “{b.batch_instruction}”
                    </p>
                  )}
                  {b.archived ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={restoring !== null}
                      onClick={() => restore(b.batch_id)}
                    >
                      {restoring === b.batch_id ? "복원 중..." : "이 배치 복원"}
                    </Button>
                  ) : (
                    <p className="text-[11px] text-primary font-medium">
                      ✓ 현재 활성 배치
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
