"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopProgressBar } from "@/components/notifications/TopProgressBar";
import { CompletionBanner } from "@/components/notifications/CompletionBanner";
import { ActivityCenter } from "@/components/notifications/ActivityCenter";

const BARE_PREFIXES = ["/login", "/auth"];

export function ShellChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (bare) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <TopProgressBar />
        <CompletionBanner />
        <div className="max-w-6xl mx-auto p-6">
          <div className="flex justify-end mb-2 -mt-2">
            <ActivityCenter />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
