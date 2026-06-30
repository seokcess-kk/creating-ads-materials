"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLineIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download";

type State = "idle" | "loading" | "done";

/**
 * 갤러리 썸네일용 다운로드 타일. 이미지를 클릭하면 다운로드되고,
 * hover 시 다운로드 아이콘 오버레이, 진행 중에는 스피너/완료 체크를 항상 노출한다.
 */
export function DownloadThumb({
  url,
  filename,
  alt,
  className,
}: {
  url: string;
  filename: string;
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      await downloadFile(url, filename);
      setState("done");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2200);
    } catch (err) {
      setState("idle");
      toast.error(
        err instanceof Error ? err.message : "다운로드 실패 — 다시 시도해 주세요",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      aria-label={`${alt} 다운로드`}
      aria-busy={state === "loading"}
      className="group relative block overflow-hidden rounded-md transition-transform active:scale-95 disabled:active:scale-100"
    >
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className={cn(
          "h-28 w-28 rounded-md border object-cover transition group-hover:brightness-90",
          className,
        )}
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center text-white transition-opacity",
          state === "idle"
            ? "bg-black/0 opacity-0 group-hover:bg-black/35 group-hover:opacity-100"
            : "bg-black/45 opacity-100",
        )}
        aria-hidden
      >
        {state === "loading" ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : state === "done" ? (
          <CheckIcon className="size-5" />
        ) : (
          <ArrowDownToLineIcon className="size-5" />
        )}
      </span>
    </button>
  );
}
