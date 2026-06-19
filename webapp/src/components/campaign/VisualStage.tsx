"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { VisualValidatorResult } from "@/lib/prompts/visual";
import { BatchRegenerateBox, type RegenMode } from "./BatchRegenerateBox";
import { BatchHistoryDrawer } from "./BatchHistoryDrawer";
import { StaleBanner } from "./StaleBanner";
import { RunningStatus } from "./RunningStatus";
import { useStagePolling } from "./useStagePolling";
import { useNotifications } from "@/components/notifications/NotificationContext";
import { useStateFromProps } from "@/lib/hooks/use-state-from-props";

const VISUAL_STEPS = [
  { label: "프롬프트 3개 구성", atSec: 0 },
  { label: "AI 이미지 3장 병렬 생성", atSec: 8 },
  { label: "Storage 업로드", atSec: 85 },
  { label: "Claude Vision 4축 검증", atSec: 100 },
];

const COMPOSE_STEPS = [
  { label: "배경 + 로고 합성", atSec: 0 },
  { label: "업로드", atSec: 8 },
];

type AutomationLevel = "manual" | "assist" | "auto";

import {
  aspectClass,
  variantGridCols,
  type ChannelAspectRatio,
} from "./aspect-layout";

interface VisualStageProps {
  campaignId: string;
  runId: string | null;
  copyReady: boolean;
  aspectRatio?: ChannelAspectRatio;
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
  automationLevel?: AutomationLevel;
}

function scoreRow(label: string, value: number | undefined) {
  if (value === undefined) return null;
  const w = Math.round(((value - 1) / 4) * 100);
  return (
    <div key={label} className="flex items-center gap-2 text-xs">
      <span className="w-28 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${w}%` }} />
      </div>
      <span className="w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function VisualStage({
  campaignId,
  runId,
  copyReady,
  aspectRatio,
  initialStage,
  initialVariants,
  automationLevel = "manual",
}: VisualStageProps) {
  const ac = aspectClass(aspectRatio);
  const router = useRouter();
  const [stage, setStage] = useStateFromProps<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useStateFromProps<CreativeVariant[]>(initialVariants);
  const [generating, setGenerating] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [historyToken, setHistoryToken] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  const autoStartedRef = useRef(false);
  const { startOp, completeOp, failOp } = useNotifications();

  const runQS = runId ? `?runId=${runId}` : "";
  const isAuto = automationLevel !== "manual"; // 자동 선택(표시 축약)
  const isAutoAdvance = automationLevel === "auto"; // 다음 단계까지 자동 진행

  useStagePolling({
    campaignId,
    runId,
    stage: "visual",
    status: stage?.status,
    onUpdate: ({ stage: s, variants: v }) => {
      if (s) setStage(s);
      setVariants(v);
      router.refresh();
    },
  });

  async function generate(opts?: {
    instruction: string;
    mode: RegenMode;
    baseVariantId?: string;
  }) {
    const body = opts
      ? {
          instruction: opts.instruction || undefined,
          mode: opts.mode,
          baseVariantId: opts.baseVariantId,
        }
      : { mode: "replace" as RegenMode };
    setGenerating(true);
    const opTitle =
      opts?.mode === "add"
        ? "Visual 추가 변형"
        : opts?.mode === "remix"
          ? "Visual 리믹스"
          : "Visual 생성";
    const opId = startOp({
      kind: "visual",
      title: opTitle,
      estimatedSeconds: 135,
      steps: VISUAL_STEPS,
      href: `/campaigns/${campaignId}`,
    });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/visual${runQS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setStage(data.stage);
      if (opts?.mode === "add") {
        setVariants((prev) => [...prev, ...data.variants]);
      } else {
        setVariants(data.variants);
      }
      setHistoryToken((n) => n + 1);
      const subtitle = data.failures?.length
        ? `${data.variants.length}개 성공 · ${data.failures.length}개 실패`
        : `${data.variants.length}개 비주얼 생성`;
      completeOp(opId, {
        subtitle,
        href: `/campaigns/${campaignId}`,
      });
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function onRestored() {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/visual${runQS}`);
      const data = await res.json();
      if (res.ok) {
        setVariants(data.variants ?? []);
        setHistoryToken((n) => n + 1);
      }
      router.refresh();
    } catch {}
  }

  async function select(variantId: string) {
    setSelecting(variantId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/visual/select${runQS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "선택 실패");
      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );

      // auto: Retouch를 건너뛰고 로고 기본값으로 1패스 자동 합성 + Ship 승격.
      // 합성은 모델 없이 빠르므로(≈15s) 선택 즉시 진행. 합성 실패해도 Visual 선택은 유지.
      if (isAutoAdvance) {
        const opId = startOp({
          kind: "compose",
          title: "Compose 자동 합성",
          estimatedSeconds: 15,
          steps: COMPOSE_STEPS,
          href: `/campaigns/${campaignId}`,
        });
        try {
          const cr = await fetch(`/api/campaigns/${campaignId}/compose${runQS}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const cd = await cr.json();
          if (!cr.ok) throw new Error(cd.error ?? "합성 실패");
          completeOp(opId, {
            subtitle: cd.logoApplied ? "로고 합성 완료 — Ship 준비" : "합성 완료 — Ship 준비",
            href: `/campaigns/${campaignId}`,
          });
          toast.success("자동 합성 완료 — Ship 단계로");
        } catch (ce) {
          const msg = ce instanceof Error ? ce.message : "합성 실패";
          failOp(opId, msg);
          toast.error(`자동 합성 실패 — Compose 단계에서 직접 합성하세요 (${msg})`);
        }
      } else {
        toast.success("Visual 선택 — Retouch 단계로");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  // auto 모드만: Copy가 준비되면 Visual 생성을 자동 시작('Visual 생성' 클릭 제거).
  // stage가 아예 없을 때(stale/실패는 사용자 판단)에만, 1회.
  useEffect(() => {
    if (!isAutoAdvance) return;
    if (copyReady && !stage && !generating && !autoStartedRef.current) {
      autoStartedRef.current = true;
      toast.message("자동 진행: Visual 생성 시작");
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoAdvance, copyReady, stage, generating]);

  if (!copyReady) return null;

  if (!stage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">③ Visual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            AI 이미지 모델로 3변형(제품·숫자·인물 포커스) 병렬 생성 + Claude Vision 4축 검증
          </p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "생성 중..." : "Visual 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">③ Visual — 실패</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">{stage.error}</p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "재생성 중..." : "다시 시도"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "running") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">③ Visual 생성 중</CardTitle>
        </CardHeader>
        <CardContent>
          <RunningStatus
            label="이미지 3장 병렬 생성 + Vision 검증 중"
            startedAt={stage.started_at}
            estimatedSeconds={135}
            steps={VISUAL_STEPS}
          />
        </CardContent>
      </Card>
    );
  }

  const isStale = stage.status === "stale";
  const showVariants =
    (stage.status === "ready" || stage.status === "stale") && variants.length > 0;
  if (!showVariants) return null;

  const selectedId = variants.find((v) => v.selected)?.id ?? null;
  const sorted = [...variants].sort((a, b) => {
    const sa = (a.scores_json as Partial<VisualValidatorResult>)?.overall ?? 0;
    const sb = (b.scores_json as Partial<VisualValidatorResult>)?.overall ?? 0;
    return sb - sa;
  });
  // assist/auto: 자동 선택된 시안 1개만 기본 노출, 나머지는 '다른 시안 보기'로 펼침
  const collapsed = isAuto && !showAll && selectedId != null && variants.length > 1;
  const displayVariants = collapsed
    ? sorted.filter((v) => v.id === selectedId)
    : sorted;

  const currentBatchIndex = variants[0]?.batch_index ?? 1;
  const currentInstruction = variants[0]?.batch_instruction ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            ③ Visual — {variants.length}변형
            <Badge variant="outline" className="text-[10px]">
              배치 #{currentBatchIndex}
            </Badge>
          </span>
          <div className="flex items-center gap-1">
            <BatchHistoryDrawer
              campaignId={campaignId}
              runId={runId}
              stage="visual"
              refreshToken={historyToken}
              onRestored={onRestored}
            />
            <Badge variant="outline">선택 필요</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isStale && (
          <StaleBanner
            stage="Visual"
            upstreamStage="Copy"
            onRegenerate={() => generate()}
            running={generating}
          />
        )}
        {currentInstruction && (
          <p className="text-xs text-muted-foreground italic border-l-2 pl-2">
            지시: “{currentInstruction}”
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {isAutoAdvance
            ? "자동 선택된 시안입니다. 로고 합성 → Ship까지 자동 진행됩니다. 다른 시안을 고르면 그 시안으로 다시 합성합니다."
            : isAuto
              ? "최고점 시안이 자동 선택됐습니다. 그대로 Compose로 진행하거나 다른 시안을 선택하세요."
              : "overall 점수 내림차순. 하나를 선택하면 Retouch/Compose/Ship 단계가 활성화됩니다."}
        </p>
        {collapsed && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            다른 시안 {variants.length - 1}개 보기
          </button>
        )}
        <div className={`grid gap-3 ${variantGridCols(aspectRatio)}`}>
          {displayVariants.map((v) => {
            const c = v.content_json as {
              url: string;
              focusLabel: string;
              focus: string;
            };
            const s = v.scores_json as Partial<VisualValidatorResult> & {
              validatorError?: string;
            };
            const isSelected = v.selected;
            return (
              <Card
                key={v.id}
                className={
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40 transition-colors"
                }
              >
                <div
                  className={`${ac} relative overflow-hidden rounded-t-md border-b bg-muted/20 flex items-center justify-center`}
                >
                  {/* 클릭 시 라이트박스로 확대 — 한국어 타이포 가독성 판단용 */}
                  <button
                    type="button"
                    onClick={() => setZoom({ url: c.url, label: c.focusLabel })}
                    className="group h-full w-full cursor-zoom-in"
                    aria-label={`${c.focusLabel} 시안 확대`}
                  >
                    <img src={c.url} alt={c.focusLabel} className="h-full w-full object-contain" />
                    <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      확대 ⤢
                    </span>
                  </button>
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{c.focusLabel}</CardTitle>
                    <div className="flex gap-1">
                      {s?.overall != null && (
                        <Badge variant="secondary">{s.overall.toFixed(1)}</Badge>
                      )}
                      {isSelected && <Badge variant="secondary">selected</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {s?.validatorError ? (
                    <p className="text-xs text-destructive">Validator: {s.validatorError}</p>
                  ) : (
                    <div className="space-y-1">
                      {scoreRow("hook strength", s?.hookStrength)}
                      {scoreRow("text ready", s?.textReady)}
                      {scoreRow("brand consistency", s?.brandConsistency)}
                      {scoreRow("policy clear", s?.policyClear)}
                    </div>
                  )}
                  {(s?.issues?.length ?? 0) > 0 && (
                    <div className="text-xs">
                      <p className="font-medium text-destructive">Issues</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {s.issues?.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={isSelected ? "outline" : "default"}
                    className="w-full"
                    onClick={() => select(v.id)}
                    disabled={selecting !== null || isSelected}
                  >
                    {selecting === v.id
                      ? isAutoAdvance
                        ? "합성 중..."
                        : "선택 중..."
                      : isSelected
                        ? "선택됨"
                        : isAutoAdvance
                          ? "이 시안으로 합성"
                          : "이 비주얼 선택"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="pt-2">
          <BatchRegenerateBox
            label="재생성"
            placeholder="예: 더 미니멀 / 제품 위주 / 더 밝은 톤"
            suggestions={[
              "더 미니멀·여백 많이",
              "제품·UI 중심으로",
              "숫자를 훨씬 크게",
              "더 밝은 톤",
              "따뜻한 컬러 팔레트",
            ]}
            running={generating}
            hasVariants={variants.length > 0}
            selectedVariantId={selectedId}
            onRegenerate={generate}
          />
        </div>
      </CardContent>

      {/* 라이트박스 — 시안 확대(한국어 타이포 가독성 판단) */}
      <Dialog open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-sm">{zoom?.label ?? "시안"}</DialogTitle>
          {zoom && (
            <div className="space-y-2">
              <img
                src={zoom.url}
                alt={zoom.label}
                className="mx-auto max-h-[78vh] w-auto rounded-md border object-contain"
              />
              <a
                href={zoom.url}
                target="_blank"
                rel="noreferrer"
                className="block text-right text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                원본 열기 ↗
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
