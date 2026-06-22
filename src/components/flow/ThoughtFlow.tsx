"use client";

import { Trash2 } from "lucide-react";
import { useThoughtsStore } from "@/store/thoughts-store";
import { useHydrated } from "@/hooks/useHydrated";
import { relativeDay, formatTime } from "@/lib/utils";

export function ThoughtFlow() {
  const hydrated = useHydrated();
  const thoughts = useThoughtsStore((s) => s.thoughts);
  const removeThought = useThoughtsStore((s) => s.removeThought);

  if (!hydrated) {
    return <p className="text-[14px] text-muted">加载中…</p>;
  }

  if (thoughts.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
        <p className="text-[15px] text-muted">还没有记录。回到「今日」写下第一笔念头吧。</p>
      </div>
    );
  }

  return (
    <div className="columns-1 gap-5 md:columns-2">
      {thoughts.map((t) => (
        <div
          key={t.id}
          className="group mb-5 break-inside-avoid rounded-[12px] border border-line bg-surface p-5 shadow-card"
        >
          <div className="mb-2.5 flex items-center gap-2 text-[11.5px] tracking-wide text-muted">
            <b className="font-serif font-semibold text-terra">{relativeDay(t.createdAt)}</b>
            <span>· {formatTime(t.createdAt)}</span>
            <button
              type="button"
              onClick={() => removeThought(t.id)}
              aria-label="删除"
              className="ml-auto opacity-0 transition hover:text-terra-deep group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="font-serif text-[15px] leading-[1.75] text-ink">{t.content}</p>
          {t.tags.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {t.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[5px] bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft"
                >
                  # {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
