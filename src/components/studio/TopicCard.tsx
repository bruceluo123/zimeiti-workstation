"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Topic } from "@/types/topic";
import { PLATFORMS, STAGE_ORDER } from "@/types/topic";
import { useTopicsStore } from "@/store/topics-store";

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const moveTopic = useTopicsStore((s) => s.moveTopic);
  const removeTopic = useTopicsStore((s) => s.removeTopic);

  const stageIndex = STAGE_ORDER.indexOf(topic.stage);
  const isFirst = stageIndex === 0;
  const isLast = stageIndex === STAGE_ORDER.length - 1;

  return (
    <div className="group rounded-[10px] border border-line bg-surface p-3.5 shadow-[0_1px_2px_rgba(43,38,34,0.04)] transition hover:-translate-y-px hover:border-terra hover:shadow-card">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-serif text-[14.5px] font-semibold leading-snug text-ink">
          {topic.title}
        </p>
        <button
          type="button"
          onClick={() => removeTopic(topic.id)}
          aria-label="删除选题"
          className="flex-none text-muted opacity-0 transition hover:text-terra-deep group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {topic.note ? (
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{topic.note}</p>
      ) : null}

      <div className="mt-3 flex items-center gap-1.5">
        {topic.platforms.map((p) => {
          const meta = PLATFORMS[p];
          return (
            <span
              key={p}
              className="rounded-[5px] px-[7px] py-0.5 text-[10.5px] font-medium"
              style={{ color: meta.fg, background: meta.bg }}
            >
              {meta.label}
            </span>
          );
        })}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => moveTopic(topic.id, "prev")}
            disabled={isFirst}
            aria-label="退回上一阶段"
            className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => moveTopic(topic.id, "next")}
            disabled={isLast}
            aria-label="推进到下一阶段"
            className="grid h-6 w-6 place-items-center rounded-md text-terra transition hover:bg-terra-wash disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
