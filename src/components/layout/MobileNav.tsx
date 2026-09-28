"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Lightbulb, PenLine, Bot, LibraryBig, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "首页", icon: Home },
  { href: "/assistant", label: "AI", icon: Bot },
  { href: "/inspire", label: "灵感", icon: Lightbulb },
  { href: "/write", label: "写作", icon: PenLine },
  { href: "/resources", label: "资源", icon: LibraryBig },
  { href: "/settings", label: "我的", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="手机主导航" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_22px_rgba(0,0,0,0.05)] backdrop-blur md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-[59px] flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-semibold text-terra" : "text-muted")}>
            <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
