"use client";

import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagInput({ value, onChange, placeholder, disabled }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              disabled={disabled}
              className="ml-1 text-muted-foreground hover:text-destructive text-xs"
              aria-label={`remove ${tag}`}
            >
              ✕
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={placeholder ?? "Enter/쉼표로 추가"}
        disabled={disabled}
      />
    </div>
  );
}
