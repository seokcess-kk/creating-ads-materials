"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BrandSummary {
  id: string;
  name: string;
  category: string | null;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/brands", label: "Brands", icon: "building" },
  { href: "/campaigns", label: "Campaigns", icon: "rocket" },
  { href: "/usage", label: "Usage", icon: "dollar" },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
  ),
  building: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
  ),
  dollar: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ),
  rocket: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();
  const [brands, setBrands] = useState<BrandSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.brands) setBrands(data.brands.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const currentBrandId = (() => {
    const m = pathname.match(/^\/brands\/([^/]+)/);
    return m ? m[1] : null;
  })();

  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">Ad Studio</h1>
        <p className="text-xs text-muted-foreground">Creative Materials</p>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {icons[item.icon]}
            {item.label}
          </Link>
        ))}

        {brands.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              최근 브랜드
            </p>
            <div className="space-y-0.5">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={`/brands/${b.id}`}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                    currentBrandId === b.id
                      ? "bg-primary/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={b.category ?? undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="truncate">{b.name}</span>
                </Link>
              ))}
            </div>
            <Link
              href="/brands/new"
              className="block px-3 py-1.5 mt-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              + 새 브랜드
            </Link>
          </div>
        )}
      </nav>
    </aside>
  );
}
