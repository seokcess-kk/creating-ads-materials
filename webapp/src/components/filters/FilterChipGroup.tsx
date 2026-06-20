import Link from "next/link";

export interface FilterOption {
  id: string;
  label: string;
  href: string;
}

interface FilterChipGroupProps {
  label?: string;
  options: FilterOption[];
  activeId: string;
  size?: "sm" | "md";
  wrap?: boolean;
}

const SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "px-2.5 py-0.5 text-[11px]",
  md: "px-3 py-1 text-xs",
};

const BASE_CLASS =
  "rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE_CLASS = "border-foreground/30 text-foreground font-medium";
const INACTIVE_CLASS = "text-muted-foreground hover:bg-muted";

export function FilterChipGroup({
  label,
  options,
  activeId,
  size = "md",
  wrap = false,
}: FilterChipGroupProps) {
  const chipsClass = wrap ? "flex flex-wrap gap-1.5" : "flex gap-1.5";
  return (
    <div className="contents">
      {label && (
        <span className="text-[11px] font-medium text-muted-foreground pt-1.5 whitespace-nowrap">
          {label}
        </span>
      )}
      <div className={chipsClass}>
        {options.map((o) => {
          const active = o.id === activeId;
          return (
            <Link
              key={o.id}
              href={o.href}
              aria-current={active ? "page" : undefined}
              className={`${BASE_CLASS} ${SIZE_CLASS[size]} ${
                active ? ACTIVE_CLASS : INACTIVE_CLASS
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
