"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listActiveChannels, getChannel } from "@/lib/channels";
import { cn } from "@/lib/utils";

interface Props {
  campaignId: string;
  currentChannel: string;
}

const CHANNELS = listActiveChannels();

type Mode = "change" | "fork";

export function CampaignChannelMenu({ campaignId, currentChannel }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<{ mode: Mode; id: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = getChannel(currentChannel);
  const targets = CHANNELS.filter((c) => c.id !== currentChannel);

  async function changeChannel(targetChannel: string) {
    const target = getChannel(targetChannel);
    const ok = confirm(
      `채널을 "${target?.label ?? targetChannel}" 으로 변경하시겠습니까?\n\n` +
        "Visual·Retouch·Compose·Ship 단계는 새 종횡비에 맞춰 다시 생성해야 하므로 stale 처리됩니다 " +
        "(히스토리는 보존, 다시 생성하면 갱신).",
    );
    if (!ok) return;

    setBusy({ mode: "change", id: targetChannel });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: targetChannel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "변경 실패");
      }
      toast.success("채널이 변경되었습니다 — Visual부터 재생성하세요");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  async function forkChannel(targetChannel: string) {
    setBusy({ mode: "fork", id: targetChannel });
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/fork-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetChannel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "복제 실패");
      toast.success("새 채널 버전 생성됨 — Visual부터 재생성");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(null);
    }
  }

  const isBusy = busy !== null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isBusy}
        title="채널 메뉴"
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        <span>{current?.label ?? currentChannel}</span>
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
            이 캠페인 채널 변경
            <span className="block text-[10px] text-muted-foreground/70">
              Visual 이후 단계는 stale 처리됩니다
            </span>
          </div>
          {targets.map((c) => {
            const b = busy?.mode === "change" && busy.id === c.id;
            return (
              <button
                key={`change-${c.id}`}
                type="button"
                onClick={() => changeChannel(c.id)}
                disabled={isBusy}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  b && "opacity-50",
                )}
              >
                <span>{c.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {b ? "변경 중..." : c.size}
                </span>
              </button>
            );
          })}
          <div className="mt-1 border-t border-b px-2 py-1.5 text-[11px] text-muted-foreground">
            다른 채널 버전 만들기
            <span className="block text-[10px] text-muted-foreground/70">
              Strategy·Copy 유지, 새 캠페인으로 분기
            </span>
          </div>
          {targets.map((c) => {
            const b = busy?.mode === "fork" && busy.id === c.id;
            return (
              <button
                key={`fork-${c.id}`}
                type="button"
                onClick={() => forkChannel(c.id)}
                disabled={isBusy}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  b && "opacity-50",
                )}
              >
                <span>+ {c.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {b ? "복제 중..." : c.size}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
