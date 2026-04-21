"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RegenerateBoxProps {
  label: string;
  placeholder?: string;
  suggestions?: string[];
  running: boolean;
  onRegenerate: (instruction: string) => Promise<void> | void;
  disabled?: boolean;
}

export function RegenerateBox({
  label,
  placeholder,
  suggestions,
  running,
  onRegenerate,
  disabled,
}: RegenerateBoxProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");

  async function handle() {
    if (!instruction.trim()) return;
    await onRegenerate(instruction.trim());
    setInstruction("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled || running}
      >
        + {label}
      </Button>
    );
  }

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">{label}</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setInstruction("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          닫기
        </button>
      </div>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={placeholder}
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
      <div className="flex justify-end">
        <Button size="sm" onClick={handle} disabled={running || !instruction.trim()}>
          {running ? "재생성 중..." : "재생성"}
        </Button>
      </div>
    </div>
  );
}
