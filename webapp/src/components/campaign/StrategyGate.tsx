"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CreativeRun, CreativeStageRow, CreativeVariant } from "@/lib/campaigns/types";
import type { StrategyAlternative } from "@/lib/prompts/strategy";
import { BatchRegenerateBox, type RegenMode } from "./BatchRegenerateBox";
import { BatchHistoryDrawer } from "./BatchHistoryDrawer";
import { StaleBanner } from "./StaleBanner";
import { RunningStatus } from "./RunningStatus";
import { useStagePolling } from "./useStagePolling";
import { useNotifications } from "@/components/notifications/NotificationContext";

const STRATEGY_STEPS = [
  { label: "브랜드 메모리 로드", atSec: 0 },
  { label: "Claude Opus 3대안 설계", atSec: 5 },
  { label: "결과 저장", atSec: 40 },
];

const COPY_STEPS = [
  { label: "Strategy 로드 + 메모리 준비", atSec: 0 },
  { label: "카피 변형 생성", atSec: 10 },
  { label: "Self-critique 4축 검증", atSec: 60 },
  { label: "저장", atSec: 85 },
];

interface StrategyGateProps {
  campaignId: string;
  initialRun: CreativeRun | null;
  initialStage: CreativeStageRow | null;
  initialVariants: CreativeVariant[];
}

export function StrategyGate({
  campaignId,
  initialRun,
  initialStage,
  initialVariants,
}: StrategyGateProps) {
  const router = useRouter();
  const [run, setRun] = useState<CreativeRun | null>(initialRun);
  const [stage, setStage] = useState<CreativeStageRow | null>(initialStage);
  const [variants, setVariants] = useState<CreativeVariant[]>(initialVariants);
  const [generating, setGenerating] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [historyToken, setHistoryToken] = useState(0);
  const { startOp, completeOp, failOp } = useNotifications();

  useEffect(() => setRun(initialRun), [initialRun]);
  useEffect(() => setStage(initialStage), [initialStage]);
  useEffect(() => setVariants(initialVariants), [initialVariants]);

  useStagePolling({
    campaignId,
    stage: "strategy",
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
        ? "Strategy 추가 대안"
        : opts?.mode === "remix"
          ? "Strategy 리믹스"
          : "Strategy 생성";
    const opId = startOp({
      kind: "strategy",
      title: opTitle,
      estimatedSeconds: 45,
      steps: STRATEGY_STEPS,
      href: `/campaigns/${campaignId}`,
    });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setRun(data.run);
      setStage(data.stage);
      if (opts?.mode === "add") {
        setVariants((prev) => [...prev, ...data.variants]);
      } else {
        setVariants(data.variants);
      }
      setHistoryToken((n) => n + 1);
      completeOp(opId, {
        subtitle: `${data.variants.length}개 대안 생성`,
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

  // 카드 클릭용 경량 선택 — /strategy/select만 호출, Claude Copy 호출 없음.
  async function select(variantId: string) {
    if (selecting !== null) return;
    setSelecting(variantId);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "선택 실패");
      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  // 전략 선택(idempotent) + Copy 전체 생성을 한 번의 액션으로 묶는다.
  // 버튼 라벨 "카피 더 보기"의 의도에 맞춰 Claude Copy 변형을 바로 생성.
  async function selectAndGenerateCopy(variantId: string) {
    setSelecting(variantId);
    const opId = startOp({
      kind: "copy",
      title: "Copy 생성",
      estimatedSeconds: 90,
      steps: COPY_STEPS,
      href: `/campaigns/${campaignId}`,
    });
    try {
      const sel = await fetch(`/api/campaigns/${campaignId}/strategy/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!sel.ok) throw new Error((await sel.json()).error ?? "Strategy 선택 실패");

      const gen = await fetch(`/api/campaigns/${campaignId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "replace" }),
      });
      const data = await gen.json();
      if (!gen.ok) throw new Error(data.error ?? "Copy 생성 실패");

      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      completeOp(opId, {
        subtitle: `${data.variants?.length ?? 0}개 카피 변형 생성`,
        href: `/campaigns/${campaignId}`,
      });
      toast.success("카피 생성 완료");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "오류";
      failOp(opId, msg);
      toast.error(msg);
    } finally {
      setSelecting(null);
    }
  }

  // sampleCopy를 Copy variant로 채택 (별도 Copy Claude 호출 없이 Visual로 직행).
  async function selectAndBypass(variantId: string) {
    setSelecting(variantId);
    try {
      const sel = await fetch(`/api/campaigns/${campaignId}/strategy/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant_id: variantId }),
      });
      if (!sel.ok) throw new Error((await sel.json()).error ?? "Strategy 선택 실패");

      const byp = await fetch(
        `/api/campaigns/${campaignId}/copy/from-sample`,
        { method: "POST" },
      );
      if (!byp.ok) {
        throw new Error((await byp.json()).error ?? "샘플 카피 채택 실패");
      }

      setVariants((prev) =>
        prev.map((v) => ({ ...v, selected: v.id === variantId })),
      );
      toast.success("전략 + 샘플 카피 채택 — Visual 단계로");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSelecting(null);
    }
  }

  async function onRestored() {
    // 히스토리에서 배치 복원 → active variants 다시 로드
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/strategy`);
      const data = await res.json();
      if (res.ok) {
        setVariants(data.variants ?? []);
        setHistoryToken((n) => n + 1);
      }
      router.refresh();
    } catch {}
  }

  const hasVariants = stage?.status === "ready" && variants.length > 0;
  const selectedId = variants.find((v) => v.selected)?.id ?? null;

  if (!run || !stage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">① Strategy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Brand Memory + 플레이북 + 프레임워크 기반 3대안 설계
          </p>
          <Button onClick={() => generate()} disabled={generating}>
            {generating ? "생성 중..." : "Strategy 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (stage.status === "failed") {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base">① Strategy — 실패</CardTitle>
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
          <CardTitle className="text-base">① Strategy 생성 중</CardTitle>
        </CardHeader>
        <CardContent>
          <RunningStatus
            label="Claude Opus가 3대안을 설계하는 중"
            startedAt={stage.started_at}
            estimatedSeconds={45}
            steps={STRATEGY_STEPS}
          />
        </CardContent>
      </Card>
    );
  }

  if (!hasVariants) return null;

  const currentBatchIndex = variants[0]?.batch_index ?? 1;
  const currentInstruction = variants[0]?.batch_instruction ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            ① Strategy
            <Badge variant="outline" className="text-[10px]">
              배치 #{currentBatchIndex}
            </Badge>
          </span>
          <div className="flex items-center gap-1">
            <BatchHistoryDrawer
              campaignId={campaignId}
              stage="strategy"
              refreshToken={historyToken}
              onRestored={onRestored}
            />
            <Badge variant="outline">선택 필요</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentInstruction && (
          <p className="text-xs text-muted-foreground italic border-l-2 pl-2">
            지시: “{currentInstruction}”
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          하나를 선택하면 Copy 단계가 활성화됩니다.
        </p>
        <div className="grid md:grid-cols-3 gap-3">
          {variants.map((v) => {
            const c = v.content_json as unknown as StrategyAlternative;
            const isSelected = v.selected;
            const roleLabel =
              c.role === "safe"
                ? "🛡 Safe"
                : c.role === "explore"
                  ? "🧭 Explore"
                  : c.role === "challenge"
                    ? "⚡ Challenge"
                    : null;
            const cardDisabled = selecting !== null;
            return (
              <Card
                key={v.id}
                role="button"
                tabIndex={cardDisabled ? -1 : 0}
                aria-pressed={isSelected}
                aria-label={`전략 ${c.angleName} 선택`}
                onClick={() => {
                  if (cardDisabled) return;
                  select(v.id);
                }}
                onKeyDown={(e) => {
                  if (cardDisabled) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(v.id);
                  }
                }}
                className={
                  "cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 " +
                  (isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "hover:border-primary/40 hover:shadow-sm") +
                  (cardDisabled ? " opacity-70 cursor-wait" : "")
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleLabel && (
                      <Badge
                        variant={
                          c.role === "safe"
                            ? "secondary"
                            : c.role === "challenge"
                              ? "destructive"
                              : "outline"
                        }
                        className="text-[10px]"
                      >
                        {roleLabel}
                      </Badge>
                    )}
                    <CardTitle className="text-sm">{c.angleName}</CardTitle>
                    {isSelected && <Badge variant="secondary">selected</Badge>}
                  </div>
                  <div className="flex gap-1 pt-1">
                    <Badge variant="outline" className="text-xs">
                      {c.hookType}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {c.frameworkId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <p className="font-medium text-muted-foreground">각도</p>
                    <p>{c.angleSummary}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">핵심 메시지</p>
                    <p>{c.keyMessage}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">비주얼 방향</p>
                    <p>{c.visualDirection}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">근거</p>
                    <p>{c.whyItWorks}</p>
                  </div>
                  {c.sampleCopy && (
                    <div className="mt-2 p-2 rounded-md border bg-muted/40 space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        샘플 카피
                      </p>
                      <p className="text-sm font-semibold leading-tight">
                        {c.sampleCopy.headline}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.sampleCopy.subCopy}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.sampleCopy.cta}
                      </Badge>
                    </div>
                  )}
                  <div className="flex gap-1 mt-2">
                    {c.sampleCopy && (
                      <Button
                        size="sm"
                        variant={isSelected ? "outline" : "default"}
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAndBypass(v.id);
                        }}
                        disabled={selecting !== null}
                      >
                        {selecting === v.id
                          ? "진행 중..."
                          : "샘플로 진행"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectAndGenerateCopy(v.id);
                      }}
                      disabled={selecting !== null}
                    >
                      {selecting === v.id ? "생성 중..." : "카피 더 보기"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <BatchRegenerateBox
          label="재생성"
          placeholder="예: 더 공격적으로 / 숫자 강조 / 감성 중심"
          suggestions={[
            "더 공격적·도전적으로",
            "숫자·수치를 더 강조",
            "감성·스토리 중심으로",
          ]}
          running={generating}
          hasVariants={variants.length > 0}
          selectedVariantId={selectedId}
          onRegenerate={generate}
        />
      </CardContent>
    </Card>
  );
}
