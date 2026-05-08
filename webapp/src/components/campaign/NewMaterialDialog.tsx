"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CreativeRun } from "@/lib/campaigns/types";

type Mode = "fresh" | "branch-from-copy";

interface Props {
  campaignId: string;
  existingRuns: CreativeRun[];
  hasBranchableSource: boolean;
}

export function NewMaterialDialog({
  campaignId,
  existingRuns,
  hasBranchableSource,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(
    hasBranchableSource ? "branch-from-copy" : "fresh",
  );
  const [sourceRunId, setSourceRunId] = useState<string>(() => {
    const branchable = existingRuns.find(
      (r) => r.status === "complete" || r.status === "compose" || r.status === "ship" || r.status === "retouch" || r.status === "visual",
    );
    return branchable?.id ?? existingRuns[0]?.id ?? "";
  });
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  function reset() {
    setMode(hasBranchableSource ? "branch-from-copy" : "fresh");
    setLabel("");
  }

  async function create() {
    setCreating(true);
    try {
      const body: Record<string, unknown> = { mode };
      if (label.trim()) body.label = label.trim();
      if (mode === "branch-from-copy") {
        if (!sourceRunId) {
          toast.error("원본 소재를 선택하세요");
          return;
        }
        body.sourceRunId = sourceRunId;
      }
      const res = await fetch(`/api/campaigns/${campaignId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      toast.success(
        mode === "fresh"
          ? "새 소재 생성됨 — Strategy부터 시작"
          : "새 소재 생성됨 — Visual부터 시작 (Strategy·Copy 복사됨)",
      );
      const params = new URLSearchParams(searchParams);
      params.set("run", data.run.id);
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setCreating(false);
    }
  }

  // branch-from-copy 가능한 후보: Strategy+Copy까지 진행된 run
  const branchableRuns = existingRuns.filter((r) =>
    ["visual", "retouch", "compose", "ship", "complete"].includes(r.status),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        setOpen(o);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1">
            <PlusIcon className="h-3.5 w-3.5" />
            새 소재
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 소재 만들기</DialogTitle>
          <DialogDescription>
            같은 캠페인 안에 새로운 소재안을 추가합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset
            role="radiogroup"
            aria-labelledby="new-material-mode-label"
            className="space-y-2"
          >
            <Label id="new-material-mode-label">시작 방식</Label>
            <label
              className={cn(
                "block cursor-pointer rounded-md border p-3 transition-colors",
                mode === "fresh"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="new-material-mode"
                  checked={mode === "fresh"}
                  onChange={() => setMode("fresh")}
                  disabled={creating}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">처음부터 (Fresh)</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Strategy부터 새로 시작. 같은 오퍼·페르소나·채널이지만 완전히 다른 각도로.
                  </p>
                </div>
              </div>
            </label>
            <label
              className={cn(
                "block rounded-md border p-3 transition-colors",
                !hasBranchableSource && "cursor-not-allowed opacity-50",
                hasBranchableSource && "cursor-pointer",
                mode === "branch-from-copy" && hasBranchableSource
                  ? "border-primary bg-primary/5"
                  : hasBranchableSource && "hover:bg-muted/50",
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="new-material-mode"
                  checked={mode === "branch-from-copy"}
                  onChange={() => setMode("branch-from-copy")}
                  disabled={creating || !hasBranchableSource}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    Copy까지 복사 후 분기 (Branch from Copy)
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    원본 소재의 Strategy·Copy를 그대로 가져오고 Visual부터 새로
                    생성. 카피는 같지만 비주얼만 다른 안을 만들 때.
                  </p>
                  {!hasBranchableSource && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Strategy·Copy까지 완료된 소재가 없어 비활성화됨.
                    </p>
                  )}
                </div>
              </div>
            </label>
          </fieldset>

          {mode === "branch-from-copy" && branchableRuns.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="new-material-source">원본 소재</Label>
              <select
                id="new-material-source"
                value={sourceRunId}
                onChange={(e) => setSourceRunId(e.target.value)}
                disabled={creating}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {branchableRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label ?? `소재 ${r.iteration_index ?? "?"}`} · {r.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-material-label">이름 (선택)</Label>
            <Input
              id="new-material-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`예: 가격 강조안 / 리타겟팅 버전 (비워두면 "소재 ${existingRuns.length + 1}")`}
              maxLength={80}
              disabled={creating}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={creating}
          >
            취소
          </Button>
          <Button onClick={create} disabled={creating}>
            {creating ? "생성 중..." : "만들기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
