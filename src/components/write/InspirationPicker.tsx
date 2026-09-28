"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotebookPen, Search } from "lucide-react";
import type { Thought } from "@/types/thought";
import type { KnowledgeDraft } from "@/types/writing";

interface Props {
  thoughts: Thought[];
  drafts: KnowledgeDraft[];
  activeDraftId?: string;
  reopenToken?: number;
  hydrated: boolean;
  disabled: boolean;
  onPick: (thought: Thought) => void;
}

export function InspirationPicker({ thoughts, drafts, activeDraftId, reopenToken, hydrated, disabled, onPick }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");
  useEffect(() => { if (activeDraftId) setExpanded(false); }, [activeDraftId]);
  useEffect(() => { if (reopenToken) setExpanded(true); }, [reopenToken]);
  const usable = thoughts.filter((thought) => typeof thought.content === "string" && thought.content.trim());
  const term = query.trim().toLowerCase();
  const visible = usable
    .filter((thought) => !term || `${thought.content} ${(thought.tags || []).join(" ")}`.toLowerCase().includes(term))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5" aria-label="从灵感随笔选择">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[1.5px] text-terra">写作起点</p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold"><NotebookPen size={18} />从灵感随笔选一条</h2>
          <p className="mt-1 text-xs leading-5 text-muted">选中后带入新草稿；原随笔保留，后续修改互不影响。</p>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-9 rounded-xl border border-line px-3 text-xs font-medium text-terra" aria-expanded={expanded}>
          {expanded ? "收起灵感" : `挑选灵感${hydrated ? ` · ${usable.length}` : ""}`}
        </button>
      </div>
      {expanded && (
        <div className="mt-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input aria-label="搜索灵感随笔" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索随笔文字或标签" className="min-h-10 w-full rounded-xl border border-line bg-bg pl-9 pr-3 text-sm outline-none focus:border-terra" />
          </div>
          {!hydrated ? <p className="mt-4 text-sm text-muted">正在读取灵感随笔…</p> : !usable.length ? (
            <p className="mt-4 text-sm text-muted">还没有可写作的文字随笔。<Link href="/inspire" className="ml-1 font-medium text-terra underline">去记一笔</Link></p>
          ) : !visible.length ? <p className="mt-4 text-sm text-muted">没有匹配的灵感，换个关键词试试。</p> : (
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {visible.map((thought) => {
                const linkedDraft = drafts.find((item) => item.sourceThoughtId === thought.id);
                const active = Boolean(linkedDraft && linkedDraft.id === activeDraftId);
                return (
                  <button key={thought.id} type="button" disabled={disabled} onClick={() => onPick(thought)} className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-50 ${active ? "border-terra bg-terra-wash" : "border-line bg-bg hover:border-terra"}`}>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                      <span>{new Date(thought.createdAt).toLocaleDateString("zh-CN")}{thought.tags?.length ? ` · ${thought.tags.join(" / ")}` : ""}</span>
                      <span className="font-semibold text-terra">{active ? "当前草稿" : linkedDraft ? "继续写 →" : "用这条写 →"}</span>
                    </span>
                    <span className="mt-2 block line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-ink">{thought.content}</span>
                  </button>
                );
              })}
            </div>
          )}
          {hydrated && usable.length > 0 && <p className="mt-3 text-right text-xs text-muted">可选 {usable.length} 条文字随笔 · <Link href="/inspire" className="text-terra underline">查看全部随笔</Link></p>}
        </div>
      )}
    </section>
  );
}
