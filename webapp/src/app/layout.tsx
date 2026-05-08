import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/NotificationContext";
import { ShellChrome } from "@/components/layout/ShellChrome";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { listBrands } from "@/lib/memory";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ad Studio — Creative Materials",
  description: "AI 기반 광고 소재 제작 플랫폼",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 사이드바용 최근 브랜드 — 인증 안 된 페이지(/login)에서는 RLS로 빈 배열.
  // 서버에서 한 번만 조회 → 페이지 이동 시 client useEffect로 매번 재조회되던 비용 제거.
  let recentBrands: Array<{
    id: string;
    name: string;
    category: string | null;
  }> = [];
  try {
    const brands = await listBrands();
    recentBrands = brands.slice(0, 6).map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
    }));
  } catch {
    // 미인증 등 실패는 빈 배열로 처리 (사이드바가 그냥 안 보일 뿐)
    recentBrands = [];
  }

  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NotificationProvider>
            <ShellChrome recentBrands={recentBrands}>{children}</ShellChrome>
            <Toaster />
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
