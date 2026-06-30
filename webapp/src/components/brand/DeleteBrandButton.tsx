"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface DeleteBrandButtonProps {
  brandId: string;
  brandName: string;
  /** "button"(기본 헤더 액션) | "menu"(MoreActionsMenu 내부 아이템) */
  variant?: "button" | "menu";
}

export function DeleteBrandButton({
  brandId,
  brandName,
  variant = "button",
}: DeleteBrandButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/brands/${brandId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");

      toast.success(`${brandName} 브랜드가 삭제되었습니다`);
      setOpen(false);
      router.push("/brands");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <span
          role={variant === "menu" ? "menuitem" : undefined}
          className={
            variant === "menu"
              ? "block w-full rounded-sm px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
              : "inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent h-8 px-3 cursor-pointer text-destructive"
          }
        >
          {variant === "menu" ? "브랜드 삭제" : "삭제"}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>브랜드 삭제</DialogTitle>
          <DialogDescription>
            <strong>{brandName}</strong> 브랜드를 삭제하시겠습니까?
            <br />
            브랜드에 연결된 모든 에셋, 캠페인, 소재가 함께 삭제됩니다.
            <br />
            이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            pending={deleting}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
