"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLineIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download";

type State = "idle" | "loading" | "done";

interface DownloadButtonProps {
  url: string;
  filename: string;
  /** 평상시 라벨 (기본: "다운로드") */
  children?: React.ReactNode;
  className?: string;
  loadingLabel?: string;
  doneLabel?: string;
  /** 다운로드 아이콘 표시 여부 (loading/done 시에는 항상 상태 아이콘) */
  showIcon?: boolean;
  /** 라벨 없이 아이콘만 */
  iconOnly?: boolean;
  /** 성공 시 토스트 메시지 (선택) */
  successToast?: string;
}

/**
 * 비동기 다운로드(fetch→blob→저장)에 클릭 피드백을 입힌 버튼.
 * idle → loading(스피너·"받는 중…") → done(체크·"저장됨", 2.2초 후 복귀).
 * className으로 텍스트 링크/보더 버튼 등 어떤 형태로든 스타일링 가능(스피너는 currentColor 상속).
 */
export function DownloadButton({
  url,
  filename,
  children = "다운로드",
  className,
  loadingLabel = "받는 중…",
  doneLabel = "저장됨",
  showIcon = true,
  iconOnly = false,
  successToast,
}: DownloadButtonProps) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state === "loading") return;
    setState("loading");
    try {
      await downloadFile(url, filename);
      setState("done");
      if (successToast) toast.success(successToast);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2200);
    } catch (err) {
      setState("idle");
      toast.error(
        err instanceof Error ? err.message : "다운로드 실패 — 다시 시도해 주세요",
      );
    }
  }

  const icon =
    state === "loading" ? (
      <Loader2Icon className="size-3 shrink-0 animate-spin" aria-hidden />
    ) : state === "done" ? (
      <CheckIcon className="size-3 shrink-0" aria-hidden />
    ) : showIcon ? (
      <ArrowDownToLineIcon className="size-3 shrink-0" aria-hidden />
    ) : null;

  const label =
    state === "loading" ? loadingLabel : state === "done" ? doneLabel : children;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      aria-busy={state === "loading"}
      className={cn(
        "inline-flex items-center gap-1 transition-transform active:scale-95 disabled:cursor-progress disabled:active:scale-100",
        className,
      )}
    >
      {icon}
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
