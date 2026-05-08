"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKst } from "@/lib/format/date";
import type { CreativeRun } from "@/lib/campaigns/types";

interface Props {
  campaignId: string;
  archivedRuns: CreativeRun[];
}

export function ArchivedMaterialsDrawer({ campaignId, archivedRuns }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function restore(run: CreativeRun) {
    setRestoring(run.id);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/runs/${run.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: false }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "복원 실패");
      }
      toast.success("소재가 복원되었습니다");
      // 복원한 소재로 자동 전환
      const params = new URLSearchParams(searchParams);
      params.set("run", run.id);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setRestoring(null);
    }
  }

  if (archivedRuns.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <ArchiveIcon className="h-3.5 w-3.5" />
            보관함 ({archivedRuns.length})
          </Button>
        }
      />
      <DialogContent
        showCloseButton={false}
        className="top-0 right-0 left-auto translate-x-0 translate-y-0 w-full max-w-md sm:max-w-md h-screen rounded-none p-0 gap-0 flex flex-col"
      >
        <DialogTitle className="sr-only">보관된 소재</DialogTitle>
        <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">보관된 소재</h3>
            <p className="text-[11px] text-muted-foreground">
              복원하면 활성 목록으로 돌아오고 자동 전환됩니다
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {archivedRuns.map((run) => {
            const fallbackLabel = `소재 ${run.iteration_index ?? "?"}`;
            const isRestoring = restoring === run.id;
            return (
              <div
                key={run.id}
                className="rounded-md border bg-muted/20 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {run.label ?? fallbackLabel}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {run.status}
                      </Badge>
                      {run.rating != null && (
                        <span
                          className="text-[10px] text-amber-500"
                          aria-label={`평점 ${run.rating}`}
                        >
                          {"★".repeat(run.rating)}
                        </span>
                      )}
                      {run.archived_at && (
                        <span className="text-[10px] text-muted-foreground">
                          보관:{" "}
                          {formatKst(run.archived_at, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {run.note && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                        “{run.note}”
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore(run)}
                    disabled={restoring !== null}
                    className="shrink-0"
                  >
                    {isRestoring ? "복원 중..." : "복원"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
