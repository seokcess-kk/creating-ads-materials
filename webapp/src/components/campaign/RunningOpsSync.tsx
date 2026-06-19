"use client";

import { useEffect, useRef } from "react";
import {
  stageOpId,
  useNotifications,
  type OpKind,
} from "@/components/notifications/NotificationContext";
import type { CreativeStageName } from "@/lib/campaigns/types";

export interface RunningStageInfo {
  stage: CreativeStageName;
  runId: string | null;
  /** 서버 stage.started_at (ms). null이면 클라이언트에서 현재시각으로 대체 */
  startedAt: number | null;
}

const STAGE_META: Record<
  CreativeStageName,
  { title: string; estimatedSeconds: number }
> = {
  strategy: { title: "Strategy 생성", estimatedSeconds: 45 },
  copy: { title: "Copy 생성", estimatedSeconds: 90 },
  visual: { title: "Visual 생성", estimatedSeconds: 135 },
  retouch: { title: "Retouch 편집", estimatedSeconds: 45 },
  compose: { title: "Compose 합성", estimatedSeconds: 15 },
  ship: { title: "Ship", estimatedSeconds: 5 },
};

/**
 * 서버에서 running 상태인 stage를 전역 진행 op로 복원/동기화한다.
 * 새로고침·탭 이동으로 in-memory op가 사라져도 진행바/Activity Center가 유지된다.
 *
 * - 게이트가 in-session으로 만든 op(같은 kind running)가 있으면 건드리지 않음(중복 방지).
 * - 동기화기가 만든 op는 해당 stage가 running에서 벗어나면(폴링 완료→refresh) 완료 처리.
 */
export function RunningOpsSync({
  campaignId,
  running,
}: {
  campaignId: string;
  running: RunningStageInfo[];
}) {
  const { ops, ensureOp, completeOp } = useNotifications();
  const opsRef = useRef(ops);
  useEffect(() => {
    opsRef.current = ops;
  });
  const ownedRef = useRef<Set<string>>(new Set());

  const runningKey = running
    .map((r) => stageOpId(r.runId, r.stage))
    .sort()
    .join(",");

  useEffect(() => {
    const href = `/campaigns/${campaignId}`;
    const currentIds = new Set<string>();
    for (const r of running) {
      const id = stageOpId(r.runId, r.stage);
      currentIds.add(id);
      // 같은 kind의 running op(게이트 생성)가 이미 있으면 스킵 — 중복 방지
      const existsByKind = opsRef.current.some(
        (o) => o.kind === (r.stage as OpKind) && o.status === "running",
      );
      if (existsByKind) continue;
      const m = STAGE_META[r.stage];
      ensureOp({
        id,
        kind: r.stage as OpKind,
        title: m.title,
        estimatedSeconds: m.estimatedSeconds,
        startedAt: r.startedAt ?? Date.now(),
        href,
        celebrate: false,
      });
      ownedRef.current.add(id);
    }
    // 동기화기가 만든 op 중 더 이상 running이 아닌 것 → 완료 처리
    for (const id of [...ownedRef.current]) {
      if (!currentIds.has(id)) {
        completeOp(id, { subtitle: "완료", href });
        ownedRef.current.delete(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningKey, campaignId]);

  return null;
}
