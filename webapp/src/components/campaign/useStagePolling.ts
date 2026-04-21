"use client";

import { useEffect } from "react";
import type {
  CreativeStageName,
  CreativeStageRow,
  CreativeVariant,
} from "@/lib/campaigns/types";

interface UseStagePollingOptions {
  campaignId: string;
  stage: CreativeStageName;
  status: string | undefined;
  intervalMs?: number;
  onUpdate: (data: {
    stage: CreativeStageRow | null;
    variants: CreativeVariant[];
  }) => void;
}

/**
 * stage.status === "running"인 동안 GET /api/campaigns/[id]/[stage]를 주기적으로
 * 호출하여 완료/실패 여부를 감지한다. 완료 시 onUpdate로 전달.
 */
export function useStagePolling({
  campaignId,
  stage,
  status,
  intervalMs = 3000,
  onUpdate,
}: UseStagePollingOptions) {
  useEffect(() => {
    if (status !== "running") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/${stage}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const newStatus = data.stage?.status;
        if (newStatus && newStatus !== "running") {
          onUpdate({ stage: data.stage, variants: data.variants ?? [] });
        }
      } catch {
        // swallow — 네트워크 오류는 다음 tick에서 재시도
      }
    };
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, campaignId, stage, intervalMs]);
}
