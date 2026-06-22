"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageCircle,
  Newspaper,
  LayoutGrid,
  ImageIcon,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/useHydrated";
import { useThoughtsStore } from "@/store/thoughts-store";
import { useTopicsStore } from "@/store/topics-store";
import { computeStreak } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badgeKey?: "topics" | "publish";
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "每日",
    items: [
      { href: "/", label: "今日", icon: Home },
      { href: "/flow", label: "想法流", icon: MessageCircle },
    ],
  },
  {
    label: "生产线",
    items: [
      { href: "/inspire", label: "灵感库", icon: Newspaper },
      { href: "/studio", label: "创作台", icon: LayoutGrid, badgeKey: "topics" },
      { href: "/factory", label: "素材工厂", icon: ImageIcon },
      { href: "/publish", label: "发布箱", icon: Send, badgeKey: "publish" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const topics = useTopicsStore((s) => s.topics);
  const thoughts = useThoughtsStore((s) => s.thoughts);

  const activeTopics = topics.filter((t) => t.stage !== "published").length;
  const readyTopics = topics.filter((t) => t.stage === "ready").length;
  const streak = computeStreak(thoughts.map((t) => t.createdAt));

  const badge = (item: NavItem): number | null => {
    if (!hydrated) return null;
    if (item.badgeKey === "topics") return activeTopics || null;
    if (item.badgeKey === "publish") return readyTopics || null;
    return null;
  };

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-line bg-surface px-4 py-6">
      <Link href="/" className="mb-2 flex items-center gap-2.5 border-b border-line px-2 pb-5">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-gradient-to-br from-terra to-terra-deep font-serif text-[19px] font-semibold text-white shadow-[0_4px_10px_-3px_rgba(159,68,34,0.5)]">
          岛
        </span>
        <span>
          <span className="block font-serif text-[16px] font-semibold leading-tight tracking-wide">
            自媒体工作站
          </span>
          <span className="block text-[11px] font-light tracking-[2px] text-muted">STUDIO</span>
        </span>
      </Link>

      <nav className="mt-3 flex flex-col gap-0.5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-medium tracking-[1.5px] text-muted">
              {group.label}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              const count = badge(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[14px] transition-colors",
                    active
                      ? "bg-terra-wash font-medium text-terra-deep"
                      : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  <Icon
                    className={cn("h-[17px] w-[17px] flex-none", active && "text-terra")}
                    strokeWidth={1.7}
                  />
                  {item.label}
                  {count ? (
                    <span className="ml-auto rounded-full bg-terra px-[7px] py-px text-[11px] font-medium text-white">
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-line px-2.5 pt-3.5 text-[12px] text-muted">
        连续记录{" "}
        <b className="font-medium text-ink-soft">{hydrated ? streak : "—"} 天</b>
        <br />
        本周产出 <b className="font-medium text-ink-soft">5 条</b>
      </div>
    </aside>
  );
}
