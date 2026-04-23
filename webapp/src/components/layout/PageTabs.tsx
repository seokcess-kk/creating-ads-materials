import Link from "next/link";
import type { ReactNode } from "react";

export interface PageTabItem {
  id: string;
  label: string;
  href: string;
  count?: number | null;
  icon?: ReactNode;
}

interface PageTabsProps {
  tabs: PageTabItem[];
  activeId: string;
}

export function PageTabs({ tabs, activeId }: PageTabsProps) {
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-border/60 -mb-px overflow-x-auto"
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        return (
          <Link
            key={t.id}
            href={t.href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md ${
              active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
