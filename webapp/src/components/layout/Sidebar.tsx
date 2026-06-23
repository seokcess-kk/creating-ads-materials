"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const RECENT_BRANDS_KEY = "ad-studio:sidebar:recent-brands-open";

interface BrandSummary {
  id: string;
  name: string;
  category: string | null;
}

interface SidebarProps {
  recentBrands: BrandSummary[];
}

const navItems = [
  { href: "/", label: "홈", icon: "grid" },
  { href: "/generate", label: "단일 이미지", icon: "image" },
  { href: "/carousel", label: "캐러셀", icon: "layers" },
  { href: "/gallery", label: "갤러리", icon: "gallery" },
  { href: "/brands", label: "브랜드", icon: "building" },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
  ),
  building: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
  ),
  image: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
  ),
  layers: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>
  ),
  gallery: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="m17 18 2 2 4-4"/></svg>
  ),
};

export function Sidebar({ recentBrands }: SidebarProps) {
  const pathname = usePathname();
  const brands = recentBrands;
  const [recentOpen, setRecentOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(RECENT_BRANDS_KEY) !== "0";
  });

  function toggleRecent() {
    setRecentOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(RECENT_BRANDS_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  const currentBrandId = (() => {
    const m = pathname.match(/^\/brands\/([^/]+)/);
    return m ? m[1] : null;
  })();

  return (
    <aside className="w-60 border-r flex flex-col h-screen sticky top-0">
      <div className="p-4">
        <h1 className="text-base font-semibold tracking-tight">Ad Studio</h1>
        <p className="text-xs text-muted-foreground">Creative Materials</p>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
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
            <button
              type="button"
              onClick={toggleRecent}
              aria-expanded={recentOpen}
              aria-controls="sidebar-recent-brands"
              className="flex w-full items-center gap-1 px-3 mb-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRightIcon
                className={cn(
                  "h-3 w-3 transition-transform",
                  recentOpen && "rotate-90",
                )}
                aria-hidden
              />
              <span>최근 브랜드</span>
              <span className="ml-auto text-[10px] tabular-nums">
                {brands.length}
              </span>
            </button>
            {recentOpen && (
              <div id="sidebar-recent-brands">
                <div className="space-y-0.5">
                  {brands.map((b) => (
                    <Link
                      key={b.id}
                      href={`/brands/${b.id}`}
                      prefetch
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
                        currentBrandId === b.id
                          ? "text-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      title={b.category ?? undefined}
                    >
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
          </div>
        )}
      </nav>
      <div className="px-3 py-2 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">테마</span>
        <ThemeToggle />
      </div>
      <form action="/api/auth/logout" method="post" className="p-2">
        <button
          type="submit"
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          로그아웃
        </button>
      </form>
    </aside>
  );
}
