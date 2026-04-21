"use client";

import {
  Children,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/lib/campaigns/types";
import type { StepDef } from "./stepper-utils";

export type { StepDef } from "./stepper-utils";

interface CampaignStepperProps {
  steps: StepDef[];
  initialStage: string;
  children: React.ReactNode;
}

const STAGE_CHANGE_EVENT = "campaign-stepper:stage-change";

function subscribeUrlStage(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(STAGE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(STAGE_CHANGE_EVENT, callback);
  };
}

function readUrlStage(): string | null {
  return new URLSearchParams(window.location.search).get("stage");
}

function readServerSnapshot(): string | null {
  return null;
}

export function CampaignStepper({
  steps,
  initialStage,
  children,
}: CampaignStepperProps) {
  const urlStage = useSyncExternalStore(
    subscribeUrlStage,
    readUrlStage,
    readServerSnapshot,
  );
  const activeStage =
    urlStage && steps.some((s) => s.key === urlStage) ? urlStage : initialStage;
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.key === activeStage),
  );
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const childArray = useMemo(() => Children.toArray(children), [children]);

  const navigate = useCallback(
    (key: string) => {
      const step = steps.find((s) => s.key === key);
      if (!step || step.locked) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("stage") === key) return;
      url.searchParams.set("stage", key);
      window.history.replaceState({}, "", url.toString());
      window.dispatchEvent(new Event(STAGE_CHANGE_EVENT));
    },
    [steps],
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeStage]);

  const prev = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const next = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!e.altKey) return;
      if (e.key === "ArrowLeft" && prev && !prev.locked) {
        e.preventDefault();
        navigate(prev.key);
      } else if (e.key === "ArrowRight" && next && !next.locked) {
        e.preventDefault();
        navigate(next.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, navigate]);

  return (
    <div className="space-y-6">
      <nav
        role="tablist"
        aria-label="캠페인 파이프라인"
        className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/90 backdrop-blur border-b"
      >
        <ol className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {steps.map((step, i) => {
            const isActive = step.key === activeStage;
            const isLast = i === steps.length - 1;
            return (
              <li key={step.key} className="flex items-center shrink-0">
                <button
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  role="tab"
                  id={`step-tab-${step.key}`}
                  aria-selected={isActive}
                  aria-controls={`step-panel-${step.key}`}
                  aria-disabled={step.locked}
                  disabled={step.locked}
                  onClick={() => navigate(step.key)}
                  title={
                    step.locked
                      ? "이전 단계 완료 후 진입 가능"
                      : stepTooltip(step)
                  }
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-primary/10 text-foreground font-medium",
                    !isActive &&
                      !step.locked &&
                      "text-muted-foreground hover:bg-muted hover:text-foreground",
                    step.locked && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 transition-colors",
                      statusCircleClass(step.status, isActive),
                    )}
                    aria-hidden
                  >
                    {circleGlyph(step.status, i + 1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span>{step.label}</span>
                    {step.optional && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        선택
                      </span>
                    )}
                    {step.status === "stale" && (
                      <span
                        className="text-amber-600 text-[11px]"
                        aria-label="stale"
                      >
                        ⚠
                      </span>
                    )}
                  </span>
                </button>
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-0.5 h-px w-4 shrink-0 transition-colors",
                      step.status === "ready" ? "bg-primary/50" : "bg-border",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {childArray.map((child, i) => {
        const step = steps[i];
        if (!step) return null;
        const isActive = i === activeIndex;
        return (
          <div
            key={step.key}
            id={`step-panel-${step.key}`}
            role="tabpanel"
            aria-labelledby={`step-tab-${step.key}`}
            hidden={!isActive}
          >
            {child}
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => prev && navigate(prev.key)}
          disabled={!prev || prev.locked}
          className="gap-1"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">
            {prev ? prev.label : "이전"}
          </span>
          <span className="sm:hidden">이전</span>
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {activeIndex + 1} / {steps.length}
        </span>
        <Button
          variant={next && !next.locked ? "default" : "ghost"}
          size="sm"
          onClick={() => next && navigate(next.key)}
          disabled={!next || next.locked}
          className="gap-1"
        >
          <span className="hidden sm:inline">
            {next ? next.label : "완료"}
          </span>
          <span className="sm:hidden">다음</span>
          <span aria-hidden>→</span>
        </Button>
      </div>
    </div>
  );
}

function statusCircleClass(
  status: StageStatus | undefined,
  isActive: boolean,
): string {
  if (status === "ready") return "bg-primary text-primary-foreground";
  if (status === "running")
    return "bg-primary/60 text-primary-foreground animate-pulse";
  if (status === "stale") return "bg-amber-500 text-white";
  if (status === "failed") return "bg-destructive text-destructive-foreground";
  if (isActive) return "bg-foreground text-background";
  return "bg-muted text-muted-foreground";
}

function circleGlyph(
  status: StageStatus | undefined,
  index: number,
): React.ReactNode {
  if (status === "ready") return "✓";
  if (status === "failed") return "✗";
  return index;
}

function stepTooltip(step: StepDef): string {
  switch (step.status) {
    case "ready":
      return `${step.label} — 완료`;
    case "running":
      return `${step.label} — 생성 중`;
    case "stale":
      return `${step.label} — 상위 변경됨, 재생성 필요`;
    case "failed":
      return `${step.label} — 실패`;
    default:
      return step.label;
  }
}

