"use client";

import { useState } from "react";
import { Plus, Newspaper, Sparkles, X } from "lucide-react";
import { useTopicsStore } from "@/store/topics-store";
import { useStyleStore } from "@/store/style-store";
import { useHydrated } from "@/hooks/useHydrated";
import { STAGES } from "@/types/topic";
import type { Platform } from "@/types/topic";
import type { InspireItem, InspireResponse } from "@/types/inspire";
import { KanbanColumn } from "./KanbanColumn";

interface Suggestion {
  title: string;
  angle: string;
  hook: string;
  platforms: Platform[];
}

export function KanbanBoard() {
  const hydrated = useHydrated();
  const topics = useTopicsStore((s) => s.topics);
  const addTopic = useTopicsStore((s) => s.addTopic);
  const profile = useStyleStore((s) => s.profile);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  // 早报选题 modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [briefItems, setBriefItems] = useState<InspireItem[]>([]);
  const [userIdea, setUserIdea] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const openPicker = async () => {
    setPickerOpen(true);
    if (briefItems.length > 0) return;
    setBriefLoading(true);
    try {
      const res = await fetch("/api/inspire");
      const data = (await res.json()) as InspireResponse;
      const items = data.daily.length > 0 ? data.daily : data.ai;
      setBriefItems(items.slice(0, 10));
    } catch {
      // ignore
    } finally {
      setBriefLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setSugLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/studio/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIdea,
          briefItems: briefItems.map((it) => ({ title: it.title, summary: it.summary })),
          styleProfile: { tone: profile.tone, authorLabel: profile.authorLabel },
        }),
      });
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      setSuggestions(data.suggestions ?? []);
    } catch {
      // ignore
    } finally {
      setSugLoading(false);
    }
  };

  const pickSuggestion = (s: Suggestion, i: number) => {
    const key = `sug-${i}`;
    if (addedIds.includes(key)) return;
    addTopic(s.title, s.platforms ?? []);
    setAddedIds((prev) => [...prev, key]);
  };

  const submit = () => {
    if (!draft.trim()) { setAdding(false); return; }
    addTopic(draft, []);
    setDraft("");
    setAdding(false);
  };

  return (
    <div>
      {/* Top actions */}
      <div className="mb-4 flex items-center gap-2">
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
              className="w-[300px] rounded-[6px] border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-terra"
            />
            <button type="button" onClick={submit} className="rounded-[6px] bg-terra px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-terra-deep">
              添加
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-[6px] border border-line px-3 py-2 text-[12px] text-ink-soft transition hover:border-terra">
              取消
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-[6px] border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft transition hover:border-terra hover:text-terra-deep"
            >
              <Plus className="h-3.5 w-3.5" /> 新建选题
            </button>
            <button
              type="button"
              onClick={openPicker}
              className="flex items-center gap-1.5 rounded-[6px] border border-terra-wash bg-terra-wash px-3 py-2 text-[12px] font-medium text-terra-deep transition hover:border-terra hover:bg-terra hover:text-white"
            >
              <Newspaper className="h-3.5 w-3.5" /> 今日早报选题
            </button>
          </>
        )}
      </div>

      {/* Kanban */}
      <div className="-mx-[38px] overflow-x-auto px-[38px] pb-3.5">
        <div className="flex min-w-max gap-3">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage.key}
              topics={hydrated ? topics.filter((t) => t.stage === stage.key) : []}
            />
          ))}
        </div>
      </div>

      {/* 早报选题 modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-[640px] rounded-card border border-line bg-surface shadow-[0_8px_40px_rgba(0,0,0,0.18)]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">今日早报选题</h2>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-muted hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 pb-5 pt-4">
              {/* Brief items */}
              <p className="mb-2 text-[11.5px] font-medium tracking-wide text-muted">今日早报（{briefLoading ? "加载中…" : `${briefItems.length} 条`}）</p>
              {briefLoading ? (
                <p className="text-[12px] text-muted">正在拉取…</p>
              ) : (
                <ul className="mb-4 flex flex-col gap-1.5">
                  {briefItems.map((it) => (
                    <li key={it.id} className="flex items-start gap-2 rounded-[6px] border border-line bg-surface-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium leading-snug text-ink line-clamp-1">{it.title}</p>
                        {it.summary && <p className="mt-0.5 text-[11.5px] text-ink-soft line-clamp-1">{it.summary}</p>}
                      </div>
                    </li>
                  ))}
                  {briefItems.length === 0 && (
                    <li className="text-[12px] text-muted">暂无早报数据，可直接输入想法让 AI 筛选</li>
                  )}
                </ul>
              )}

              {/* User idea input */}
              <p className="mb-1.5 text-[11.5px] font-medium tracking-wide text-muted">我的想法（可选）</p>
              <textarea
                value={userIdea}
                onChange={(e) => setUserIdea(e.target.value)}
                placeholder="有没有想做的方向？写几个字，AI 会结合早报帮你选题…"
                rows={2}
                className="mb-3 w-full rounded-[6px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink outline-none focus:border-terra"
              />

              <button
                type="button"
                onClick={generateSuggestions}
                disabled={sugLoading}
                className="mb-4 flex items-center gap-1.5 rounded-[6px] bg-terra px-4 py-2 text-[12px] font-medium text-white transition hover:bg-terra-deep disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {sugLoading ? "AI 筛选中…" : "AI 筛选选题方向"}
              </button>

              {/* AI suggestions */}
              {suggestions.length > 0 && (
                <>
                  <p className="mb-2 text-[11.5px] font-medium tracking-wide text-muted">AI 推荐选题</p>
                  <ul className="flex flex-col gap-2">
                    {suggestions.map((s, i) => {
                      const key = `sug-${i}`;
                      const added = addedIds.includes(key);
                      return (
                        <li key={key} className="flex items-start gap-3 rounded-[6px] border border-line bg-surface-2 px-3.5 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-ink">{s.title}</p>
                            {s.angle && <p className="mt-0.5 text-[11.5px] text-ink-soft">{s.angle}</p>}
                            {s.hook && <p className="mt-1 text-[11px] italic text-muted">"{s.hook}"</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => pickSuggestion(s, i)}
                            disabled={added}
                            className="flex-none self-center rounded-[5px] border border-terra-wash bg-terra-wash px-2.5 py-1 text-[11px] font-medium text-terra-deep transition disabled:opacity-50 enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white"
                          >
                            {added ? "✓ 已加入" : "+ 加入"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
