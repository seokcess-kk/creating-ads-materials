"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeRun, CreativeStageRow } from "@/lib/campaigns/types";

interface ShipCardProps {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  composeReady: boolean;
  composeUrl: string | null;
  initialRun: CreativeRun | null;
  initialStage: CreativeStageRow | null;
}

export function ShipCard({
  campaignId,
  campaignName,
  campaignStatus,
  composeReady,
  composeUrl,
  initialRun,
  initialStage,
}: ShipCardProps) {
  const router = useRouter();
  const [run, setRun] = useState<CreativeRun | null>(initialRun);
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => setRun(initialRun), [initialRun]);
  useEffect(() => setStage(initialStage), [initialStage]);

  async function finalize() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ship`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "완료 처리 실패");
      toast.success("캠페인 완료 — 아카이브 저장됨");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setFinalizing(false);
    }
  }

  if (!composeReady) return null;

  const isShipped = stage?.status === "ready" && run?.status === "complete";
  const isCompleted = campaignStatus === "completed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>⑥ Ship</span>
          {isShipped || isCompleted ? (
            <Badge variant="secondary">Shipped</Badge>
          ) : (
            <Badge variant="outline">최종 승인 + 다운로드</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">최종 소재</p>
            {composeUrl ? (
              <a href={composeUrl} target="_blank" rel="noreferrer">
                <img
                  src={composeUrl}
                  alt="final"
                  className="w-full aspect-square rounded-md border object-cover"
                />
              </a>
            ) : (
              <div className="w-full aspect-square rounded-md border" />
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">캠페인</p>
              <p className="text-sm font-medium">{campaignName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">상태</p>
              <div className="flex gap-1 pt-0.5">
                <Badge variant={isCompleted ? "secondary" : "outline"}>
                  {campaignStatus}
                </Badge>
                {run && <Badge variant="outline">run: {run.status}</Badge>}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <a
                href={`/api/campaigns/${campaignId}/ship/download`}
                className="inline-flex"
              >
                <Button>PNG 다운로드</Button>
              </a>
              {!isShipped && !isCompleted && (
                <Button
                  variant="outline"
                  onClick={finalize}
                  disabled={finalizing}
                >
                  {finalizing ? "완료 처리 중..." : "최종 완료 표시"}
                </Button>
              )}
            </div>

            {(isShipped || isCompleted) && (
              <p className="text-xs text-muted-foreground pt-2">
                아카이브 스냅샷이 저장되었습니다 (playbook·prompt 버전 포함).
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
