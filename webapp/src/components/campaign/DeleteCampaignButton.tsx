"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeleteCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  redirectTo?: string;
  variant?: "button" | "icon";
}

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  redirectTo,
  variant = "button",
}: DeleteCampaignButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleTriggerClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("삭제 실패");

      toast.success(`${campaignName} 캠페인이 삭제되었습니다`);
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-label="캠페인 삭제"
        className={
          variant === "icon"
            ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-destructive hover:bg-destructive/10 cursor-pointer text-xs"
            : "inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-8 px-3 cursor-pointer text-destructive"
        }
      >
        {variant === "icon" ? "✕" : "삭제"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>캠페인 삭제</DialogTitle>
          <DialogDescription>
            <strong>{campaignName}</strong> 캠페인을 삭제하시겠습니까?
            <br />
            캠페인의 모든 런, 스테이지, 변형이 함께 삭제됩니다.
            <br />
            이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
