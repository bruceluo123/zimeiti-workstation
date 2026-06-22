"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTopicsStore } from "@/store/topics-store";
import { useHydrated } from "@/hooks/useHydrated";
import { STAGES } from "@/types/topic";
import { KanbanColumn } from "./KanbanColumn";

export function KanbanBoard() {
  const hydrated = useHydrated();
  const topics = useTopicsStore((s) => s.topics);
  const addTopic = useTopicsStore((s) => s.addTopic);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const submit = () => {
    if (!draft.trim()) {
      setAdding(false);
      return;
    }
    addTopic(draft, []);
    setDraft("");
    setAdding(false);
  };

  return (
    <div>
      <div className="mb-4">
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="新选题标题，回车保存…"
              className="w-[320px] rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] outline-none focus:border-terra"
            />
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-terra px-4 py-2 text-[13px] font-medium text-white transition hover:bg-terra-deep"
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-line px-3 py-2 text-[13px] text-ink-soft transition hover:border-terra hover:text-terra-deep"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-soft transition hover:border-terra hover:text-terra-deep"
          >
            <Plus className="h-4 w-4" />
            新建选题
          </button>
        )}
      </div>

      <div className="-mx-[38px] overflow-x-auto px-[38px] pb-3.5">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage.key}
              topics={hydrated ? topics.filter((t) => t.stage === stage.key) : []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
