import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function relativeDay(iso: string): string {
  const then = new Date(iso);
  const today = new Date();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((startOfToday - startOfThen) / DAY_MS);
  if (diff === 0) return "今天";
  if (diff === 1) return "昨天";
  if (diff === 2) return "前天";
  return then.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

/** Count consecutive days ending today that have at least one entry. */
export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const daySet = new Set(
    dates.map((iso) => {
      const d = new Date(iso);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    })
  );
  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // allow streak to count even if today has no entry yet (start from most recent active day)
  if (!daySet.has(cursor)) cursor -= DAY_MS;
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
