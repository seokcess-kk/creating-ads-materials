"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { BatchMode } from "@/lib/campaigns/types";

export type RegenMode = Extract<BatchMode, "replace" | "add" | "remix">;

interface BatchRegenerateBoxProps {
  label?: string;
  placeholder?: string;
  suggestions?: string[];
  running: boolean;
  hasVariants: boolean;
  selectedVariantId: string | null;
  disabled?: boolean;
  allowRemix?: boolean;
  onRegenerate: (input: {
    instruction: string;
    mode: RegenMode;
    baseVariantId?: string;
  }) => Promise<void> | void;
}

const MODE_META: Record<RegenMode, { icon: string; title: string; desc: string }> = {
  replace: {
    icon: "🔄",
    title: "교체",
    desc: "현재 대안을 새것으로 교체 (이전은 히스토리로 이동)",
  },
  add: {
    icon: "➕",
    title: "추가",
    desc: "기존 대안에 더하기 — 다른 각도로 누적",
  },
  remix: {
    icon: "🧬",
    title: "리믹스",
    desc: "선택된 대안을 기반으로 변형",
  },
};

export function BatchRegenerateBox({
  label = "재생성",
  placeholder,
  suggestions,
  running,
  hasVariants,
  selectedVariantId,
  disabled,
  allowRemix = false,
  onRegenerate,
}: BatchRegenerateBoxProps) {
  const [mode, setMode] = useState<RegenMode>(hasVariants ? "replace" : "replace");
  const [instruction, setInstruction] = useState("");

  async function submit() {
    const trimmed = instruction.trim();
    if (mode === "remix" && !selectedVariantId) return;
    await onRegenerate({
      instruction: trimmed,
      mode,
      baseVariantId: mode === "remix" ? selectedVariantId ?? undefined : undefined,
    });
    setInstruction("");
  }

  const disabledSubmit =
    running ||
    disabled ||
    (mode === "remix" && !selectedVariantId);

  const modes: RegenMode[] = hasVariants
    ? allowRemix
      ? ["replace", "add", "remix"]
      : ["replace", "add"]
    : ["replace"];

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{label}</p>
        {hasVariants && (
          <Badge variant="outline" className="text-[10px]">
            {MODE_META[mode].desc}
          </Badge>
        )}
      </div>

      {hasVariants && (
        <div className="flex gap-1">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={running || (m === "remix" && !selectedVariantId)}
              className={
                "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors " +
                (mode === m
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted disabled:opacity-40")
              }
              title={MODE_META[m].desc}
            >
              <span className="mr-1">{MODE_META[m].icon}</span>
              {MODE_META[m].title}
            </button>
          ))}
        </div>
      )}

      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={
          placeholder ??
          (mode === "remix"
            ? "선택된 대안을 어떻게 변형할까요?"
            : "방향·톤·강조점 (선택, 비워도 됨)")
        }
        rows={2}
        disabled={running}
      />

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInstruction(s)}
              disabled={running}
              className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-[11px] text-muted-foreground">
          {mode === "replace" && "이전 대안은 우측 히스토리에서 되살릴 수 있습니다"}
          {mode === "add" && "새 대안이 현재 대안 옆에 추가됩니다"}
          {mode === "remix" &&
            (selectedVariantId
              ? "선택된 대안을 기반으로 변형합니다"
              : "먼저 대안을 선택해주세요")}
        </p>
        <Button size="sm" onClick={submit} disabled={disabledSubmit}>
          {running ? "생성 중..." : `${MODE_META[mode].icon} ${MODE_META[mode].title}`}
        </Button>
      </div>
    </div>
  );
}
