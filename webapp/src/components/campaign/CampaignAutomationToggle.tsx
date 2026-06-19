"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AutomationLevel } from "@/lib/campaigns/types";
import { cn } from "@/lib/utils";

interface Props {
  campaignId: string;
  level: AutomationLevel;
}

const OPTIONS: Array<{
  id: AutomationLevel;
  label: string;
  icon: string;
  desc: string;
}> = [
  {
    id: "manual",
    label: "Manual",
    icon: "🧑‍💻",
    desc: "모든 선택·생성을 직접",
  },
  {
    id: "assist",
    label: "Assist",
    icon: "✨",
    desc: "각 단계 최고점을 자동 선택 (생성은 직접)",
  },
  {
    id: "auto",
    label: "Auto",
    icon: "🚀",
    desc: "선택·생성·합성을 Ship 직전까지 자동 진행",
  },
];

export function CampaignAutomationToggle({ campaignId, level }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const current = OPTIONS.find((o) => o.id === level) ?? OPTIONS[1];

  async function pick(next: AutomationLevel) {
    if (next === level) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation_level: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "수정 실패");
      }
      toast.success(`자동화 수준: ${next}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  const variantClass =
    level === "auto"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : level === "assist"
        ? "border-secondary bg-secondary text-secondary-foreground"
        : "border-input bg-background text-foreground";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title="자동화 수준 변경"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors hover:opacity-80 disabled:opacity-50",
          variantClass,
        )}
      >
        <span>
          {current.icon} {current.label}
        </span>
        <span className="opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="border-b px-2 py-1.5 text-[11px] text-muted-foreground">
            자동화 수준
          </div>
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              disabled={saving}
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                opt.id === level && "bg-muted",
              )}
            >
              <span>{opt.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{opt.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {opt.desc}
                </div>
              </div>
              {opt.id === level && (
                <span className="text-[10px] text-muted-foreground">현재</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
