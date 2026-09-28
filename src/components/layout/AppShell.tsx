"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/access-denied") return <>{children}</>;
  return (
    <>
      <div className="min-h-screen md:grid md:grid-cols-[228px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0 pb-20 md:pb-0">
          <TopBar />
          <main className="animate-fade-up">{children}</main>
        </div>
      </div>
      <MobileNav />
    </>
  );
}
