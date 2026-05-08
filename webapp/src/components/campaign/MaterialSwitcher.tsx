"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon, ArchiveIcon, CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NewMaterialDialog } from "./NewMaterialDialog";
import type { CreativeRun } from "@/lib/campaigns/types";

interface Props {
  campaignId: string;
  runs: CreativeRun[];
  activeRunId: string | null;
  /** 캠페인에 변형 가능한 Strategy+Copy 소재가 있는지 — branch-from-copy 활성화 조건 */
  hasBranchableSource: boolean;
}

function statusLabel(status: CreativeRun["status"]): {
  text: string;
  tone: "default" | "secondary" | "outline" | "destructive";
} {
  switch (status) {
    case "complete":
      return { text: "Ship 완료", tone: "secondary" };
    case "failed":
      return { text: "실패", tone: "destructive" };
    case "pending":
      return { text: "대기", tone: "outline" };
    default:
      return { text: status, tone: "outline" };
  }
}

export function MaterialSwitcher({
  campaignId,
  runs,
  activeRunId,
  hasBranchableSource,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  function navigateToRun(runId: string) {
    const params = new URLSearchParams(searchParams);
    params.set("run", runId);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function startRename(run: CreativeRun) {
    setEditingId(run.id);
    setEditDraft(run.label ?? `소재 ${run.iteration_index ?? "?"}`);
  }

  function cancelRename() {
    setEditingId(null);
  }

  async function commitRename(run: CreativeRun) {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === run.label) {
      setEditingId(null);
      return;
    }
    setSavingId(run.id);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/runs/${run.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: trimmed }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "수정 실패");
      }
      toast.success("소재명 변경됨");
      setEditingId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSavingId(null);
    }
  }

  async function archive(run: CreativeRun) {
    if (!confirm(`"${run.label ?? "소재"}"을 보관함으로 옮길까요?`)) return;
    setSavingId(run.id);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/runs/${run.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        },
      );
      if (!res.ok) throw new Error("보관 실패");
      toast.success("보관함으로 이동됨");
      // 활성 run을 보관하면 다른 run으로 자동 전환
      if (run.id === activeRunId) {
        const remaining = runs.find((r) => r.id !== run.id);
        const params = new URLSearchParams(searchParams);
        if (remaining) params.set("run", remaining.id);
        else params.delete("run");
        router.push(`${pathname}?${params.toString()}`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSavingId(null);
    }
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          아직 소재가 없습니다. Strategy 단계를 시작하거나 새 소재를 만드세요.
        </p>
        <NewMaterialDialog
          campaignId={campaignId}
          existingRuns={runs}
          hasBranchableSource={hasBranchableSource}
        />
      </div>
    );
  }

  const shippedCount = runs.filter((r) => r.status === "complete").length;
  const runningCount = runs.filter((r) =>
    ["strategy", "copy", "visual", "retouch", "compose", "ship"].includes(
      r.status,
    ),
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          소재 {runs.length}개
          {shippedCount > 0 && (
            <span className="ml-2 normal-case tracking-normal">
              · 완료 {shippedCount}
            </span>
          )}
          {runningCount > 0 && (
            <span className="ml-2 normal-case tracking-normal">
              · 진행 {runningCount}
            </span>
          )}
        </p>
        <NewMaterialDialog
          campaignId={campaignId}
          existingRuns={runs}
          hasBranchableSource={hasBranchableSource}
        />
      </div>
      <div
        role="tablist"
        aria-label="소재 선택"
        className="flex flex-wrap gap-2"
      >
        {runs.map((run) => {
          const isActive = run.id === activeRunId;
          const status = statusLabel(run.status);
          const isEditing = editingId === run.id;
          const fallbackLabel = `소재 ${run.iteration_index ?? "?"}`;
          return (
            <div
              key={run.id}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "group flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-input bg-background hover:bg-muted",
                isPending && "opacity-50",
              )}
            >
              {isEditing ? (
                <>
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(run);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    className="h-6 w-32 rounded-sm border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="소재명"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitRename(run)}
                    disabled={savingId === run.id}
                    aria-label="저장"
                    className="rounded-sm p-0.5 hover:bg-muted disabled:opacity-50"
                  >
                    <CheckIcon className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancelRename}
                    disabled={savingId === run.id}
                    aria-label="취소"
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigateToRun(run.id)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 truncate font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                    title={run.label ?? fallbackLabel}
                  >
                    <span className="max-w-[140px] truncate">
                      {run.label ?? fallbackLabel}
                    </span>
                  </button>
                  <Badge variant={status.tone} className="text-[9px]">
                    {status.text}
                  </Badge>
                  {run.rating != null && (
                    <span className="text-[10px] text-amber-500" aria-label={`평점 ${run.rating}`}>
                      {"★".repeat(run.rating)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => startRename(run)}
                    disabled={savingId === run.id || isPending}
                    aria-label="이름 변경"
                    title="이름 변경"
                    className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  {runs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => archive(run)}
                      disabled={savingId === run.id || isPending}
                      aria-label="보관"
                      title="보관"
                      className="rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
                    >
                      <ArchiveIcon className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// helper icon re-export so consumers can import it next to MaterialSwitcher
export const MaterialIcons = { PlusIcon };
