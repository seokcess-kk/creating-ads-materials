"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CreativeRun, CreativeStageRow } from "@/lib/campaigns/types";
import {
  aspectClass,
  maxHeightClass,
  previewLayoutClass,
  type ChannelAspectRatio,
} from "./aspect-layout";
import { formatKst } from "@/lib/format/date";
import { useStateFromProps } from "@/lib/hooks/use-state-from-props";

interface ShipCardProps {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  composeReady: boolean;
  composeUrl: string | null;
  aspectRatio?: ChannelAspectRatio;
  initialRun: CreativeRun | null;
  initialStage: CreativeStageRow | null;
}

export function ShipCard({
  campaignId,
  campaignName,
  campaignStatus,
  composeReady,
  composeUrl,
  aspectRatio,
  initialRun,
  initialStage,
}: ShipCardProps) {
  const ac = aspectClass(aspectRatio);
  const router = useRouter();
  const [run, setRun] = useStateFromProps<CreativeRun | null>(initialRun);
  const [stage] = useStateFromProps<CreativeStageRow | null>(initialStage);
  const [finalizing, setFinalizing] = useState(false);
  const [rating, setRating] = useStateFromProps<number | null>(initialRun?.rating ?? null);
  const [note, setNote] = useStateFromProps<string>(initialRun?.note ?? "");
  const [savingRating, setSavingRating] = useState(false);

  async function saveRating() {
    setSavingRating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ship/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: note.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "평가 저장 실패");
      setRun(data.run);
      toast.success("평가가 저장되었습니다");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSavingRating(false);
    }
  }

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

  const [promoting, setPromoting] = useState(false);
  const [promoted, setPromoted] = useState(false);

  async function promoteToBp() {
    setPromoting(true);
    toast.info("자사 BP로 승격 + Vision 분석 (10~30초)");
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/ship/promote-to-bp`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "승격 실패");
      setPromoted(true);
      toast.success("자사 BP로 승격됨 — 다음 캠페인 학습에 반영");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setPromoting(false);
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
        <div className={`grid ${previewLayoutClass(aspectRatio)}`}>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">최종 소재</p>
            {composeUrl ? (
              <a href={composeUrl} target="_blank" rel="noreferrer">
                <img
                  src={composeUrl}
                  alt="final"
                  className={`w-full ${ac} rounded-md border object-contain bg-muted/20 ${maxHeightClass(aspectRatio)} mx-auto`}
                />
              </a>
            ) : (
              <div className={`w-full ${ac} rounded-md border ${maxHeightClass(aspectRatio)} mx-auto`} />
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

            <div className="flex gap-2 pt-2 flex-wrap">
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
              {(isShipped || isCompleted) && (
                <Button
                  variant="outline"
                  onClick={promoteToBp}
                  disabled={promoting || promoted}
                  title="이 소재를 브랜드의 BP(자사 아카이브)로 등록하여 앞으로의 학습에 반영"
                >
                  {promoting
                    ? "승격 중..."
                    : promoted
                      ? "승격 완료"
                      : "자사 BP로 승격"}
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

        {(isShipped || isCompleted) && (
          <div className="pt-4 border-t space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">주관 평가</p>
                {run?.rated_at && (
                  <span className="text-[10px] text-muted-foreground">
                    마지막 저장: {formatKst(run.rated_at)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                성과 데이터가 쌓이기 전까지 선호도 학습에 활용됩니다.
              </p>
              <div className="flex gap-1" aria-label="별점">
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = rating != null && n <= rating;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(rating === n ? null : n)}
                      disabled={savingRating}
                      className="p-0.5 transition-transform hover:scale-110"
                      aria-label={`${n}점`}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill={filled ? "#FACC15" : "none"}
                        stroke={filled ? "#FACC15" : "currentColor"}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모 (선택): 이 소재가 왜 좋았는지/아쉬웠는지"
              rows={2}
              disabled={savingRating}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={saveRating}
              disabled={savingRating}
            >
              {savingRating ? "저장 중..." : "평가 저장"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
