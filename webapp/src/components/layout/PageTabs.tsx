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
      className="flex gap-1 border-b border-border/60 mb-6 overflow-x-auto"
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
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md ${
              active
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === "number" && (
              <span
                className={`text-[11px] tabular-nums ${
                  active ? "text-foreground" : "text-muted-foreground"
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
