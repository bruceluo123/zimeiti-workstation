"use client";

import type { Topic, TopicStage } from "@/types/topic";
import { STAGES } from "@/types/topic";
import { TopicCard } from "./TopicCard";

interface KanbanColumnProps {
  stage: TopicStage;
  topics: Topic[];
}

export function KanbanColumn({ stage, topics }: KanbanColumnProps) {
  const meta = STAGES.find((s) => s.key === stage)!;

  return (
    <div className="flex w-[262px] flex-none flex-col gap-3 rounded-[12px] border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-2 px-1 pb-1 pt-0.5">
        <span
          className="h-[9px] w-[9px] flex-none rounded-[3px]"
          style={{ background: meta.color }}
        />
        <h4 className="text-[13px] font-semibold text-ink">{meta.label}</h4>
        <span className="ml-auto rounded-full border border-line bg-surface px-2 py-px text-[11px] text-muted">
          {topics.length}
        </span>
      </div>

      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} />
      ))}
    </div>
  );
}
