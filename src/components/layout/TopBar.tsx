"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useThoughtsStore } from "@/store/thoughts-store";
import { computeStreak } from "@/lib/utils";
import { cn } from "@/lib/utils";

function todayLabel(): { date: string; meta: string } {
  const d = new Date();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
    meta: weekdays[d.getDay()],
  };
}

export function TopBar() {
  const hydrated = useHydrated();
  const thoughts = useThoughtsStore((s) => s.thoughts);
  const streak = computeStreak(thoughts.map((t) => t.createdAt));
  const { date, meta } = todayLabel();

  // Render last 7 days as dots, last one = today
  const dots = Array.from({ length: 7 }, (_, i) => {
    const isToday = i === 6;
    const on = hydrated && i >= 7 - Math.min(streak, 7);
    return { isToday, on };
  });

  return (
    <div className="sticky top-0 z-10 flex items-center gap-[18px] border-b border-line bg-bg/85 px-[38px] py-4 backdrop-blur">
      <div className="font-serif text-[15px] text-ink">
        {date}
        <span className="ml-2 font-sans text-[13px] text-muted">{meta}</span>
      </div>
      <div className="ml-auto flex items-center gap-2 text-[13px] text-ink-soft">
        连续打卡
        <span className="flex gap-[3px]">
          {dots.map((d, i) => (
            <i
              key={i}
              className={cn(
                "block h-[11px] w-[11px] rounded-[3px]",
                d.isToday
                  ? "bg-terra shadow-[0_0_0_2px_var(--terra-wash)]"
                  : d.on
                    ? "bg-sage"
                    : "bg-surface-2"
              )}
            />
          ))}
        </span>
        <b className="font-semibold text-terra-deep">{hydrated ? streak : "—"} 天</b>
      </div>
    </div>
  );
}
