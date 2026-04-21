"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RecomputeButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch(`/api/brands/${brandId}/learnings`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "재계산 실패");
      toast.success("학습 데이터 재계산 완료");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={run} disabled={running}>
      {running ? "재계산 중..." : "↻ 학습 재계산"}
    </Button>
  );
}
