"use client";

interface OptionChipsProps {
  options: readonly string[];
  active: string[];
  onToggle: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function OptionChips({
  options,
  active,
  onToggle,
  disabled,
  className,
}: OptionChipsProps) {
  return (
    <div className={`flex flex-wrap gap-1 pt-1 ${className ?? ""}`}>
      {options.map((o) => {
        const on = active.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            disabled={disabled}
            className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors ${
              on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            }`}
          >
            {on ? "✓ " : "+ "}
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function toggleInList<T extends string>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}
