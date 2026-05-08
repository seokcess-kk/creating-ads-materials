"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";

interface Props {
  campaignId: string;
  name: string;
}

export function CampaignNameHeader({ campaignId, name }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    setDraft(name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function cancel() {
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("캠페인명은 비울 수 없습니다");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "수정 실패");
      }
      toast.success("캠페인명이 변경되었습니다");
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div
        className="flex items-center gap-1.5"
        onBlur={(e) => {
          if (
            e.currentTarget.contains(e.relatedTarget as Node | null)
          ) {
            return;
          }
          cancel();
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          disabled={saving}
          maxLength={120}
          aria-label="캠페인명"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-2xl font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
          disabled={saving}
          title="저장 (Enter)"
          aria-label="저장"
          className="rounded-md p-1.5 text-foreground hover:bg-muted disabled:opacity-50"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          disabled={saving}
          title="취소 (Esc)"
          aria-label="취소"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      title="클릭해서 캠페인명 수정"
      className="group -mx-2 inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/50"
    >
      <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
      <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
