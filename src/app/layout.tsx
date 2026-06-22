import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { SyncProvider } from "@/components/layout/SyncProvider";

export const metadata: Metadata = {
  title: "自媒体工作站",
  description: "从念头到发布，一条线走完的内容生产平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <SyncProvider>
          <div className="grid min-h-screen grid-cols-[228px_1fr]">
            <Sidebar />
            <div>
              <TopBar />
              <main className="animate-fade-up">{children}</main>
            </div>
          </div>
        </SyncProvider>
      </body>
    </html>
  );
}
