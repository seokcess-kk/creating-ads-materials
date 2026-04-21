"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listActiveChannels } from "@/lib/channels";

interface ForkChannelMenuProps {
  campaignId: string;
  currentChannel: string;
  disabled?: boolean;
}

const CHANNELS = listActiveChannels();

export function ForkChannelMenu({
  campaignId,
  currentChannel,
  disabled,
}: ForkChannelMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [forking, setForking] = useState<string | null>(null);

  const targets = CHANNELS.filter((c) => c.id !== currentChannel);

  async function fork(targetChannel: string) {
    setForking(targetChannel);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/fork-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetChannel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "복제 실패");
      toast.success("새 채널 버전 생성됨 — Visual 단계부터 재생성");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setForking(null);
      setOpen(false);
    }
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || forking !== null}
      >
        + 다른 채널 버전 {open ? "▲" : "▼"}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 w-72 rounded-md border bg-background shadow-md p-1">
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-b">
            Strategy·Copy는 그대로, Visual부터 새 채널로 재생성
          </div>
          {targets.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => fork(c.id)}
              disabled={forking !== null}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-sm flex items-center justify-between gap-2 transition-colors"
            >
              <span>{c.label}</span>
              <Badge variant="outline" className="text-[10px]">
                {c.size}
              </Badge>
              {forking === c.id && (
                <span className="text-xs text-muted-foreground">복제 중...</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
