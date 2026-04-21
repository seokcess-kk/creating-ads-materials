import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { NotificationProvider } from "@/components/notifications/NotificationContext";
import { TopProgressBar } from "@/components/notifications/TopProgressBar";
import { CompletionBanner } from "@/components/notifications/CompletionBanner";
import { ActivityCenter } from "@/components/notifications/ActivityCenter";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex">
        <NotificationProvider>
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
          <Toaster />
        </NotificationProvider>
      </body>
    </html>
  );
}
