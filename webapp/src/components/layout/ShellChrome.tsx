"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopProgressBar } from "@/components/notifications/TopProgressBar";
import { CompletionBanner } from "@/components/notifications/CompletionBanner";
import { ActivityCenter } from "@/components/notifications/ActivityCenter";

const BARE_PREFIXES = ["/login", "/auth"];

interface RecentBrand {
  id: string;
  name: string;
  category: string | null;
}

export function ShellChrome({
  children,
  recentBrands,
}: {
  children: React.ReactNode;
  recentBrands: RecentBrand[];
}) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) return <>{children}</>;

  return (
    <>
      <Sidebar recentBrands={recentBrands} />
      <main className="flex-1 overflow-auto">
        <TopProgressBar />
        <CompletionBanner />
        <div className="mx-auto max-w-[96rem] p-6">
          <div className="-mt-2 mb-2 flex justify-end">
            <ActivityCenter />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
