"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { useTopicsStore } from "@/store/topics-store";
import type { InspireCategory, InspireItem, InspireResponse } from "@/types/inspire";
import { CATEGORY_LABEL } from "@/types/inspire";

const ALL_CATEGORIES: (InspireCategory | "all" | "x")[] = ["all", "ai-models", "ai-products", "industry", "tip", "paper", "x"];
const LABELS: Record<string, string> = { all: "全部", x: "今日 X", ...CATEGORY_LABEL };

function isToday(publishedAt: string | null): boolean {
  if (!publishedAt) return true;
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date().toLocaleDateString("zh-CN", options) === new Date(publishedAt).toLocaleDateString("zh-CN", options);
}

export function ExternalDiscovery() {
  const addTopic = useTopicsStore((state) => state.addTopic);
  const [data, setData] = useState<InspireResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    fetch("/api/inspire", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as Partial<InspireResponse>;
        if (!response.ok) throw new Error(result.error || "外部发现读取失败");
        return {
          success: result.success ?? true,
          ai: Array.isArray(result.ai) ? result.ai : [],
          daily: Array.isArray(result.daily) ? result.daily : [],
          x: Array.isArray(result.x) ? result.x : [],
          fetchedAt: result.fetchedAt ?? new Date().toISOString(),
          error: result.error,
        } satisfies InspireResponse;
      })
      .then(setData)
      .catch((cause) => setData({ success: false, ai: [], daily: [], x: [], fetchedAt: new Date().toISOString(), error: cause instanceof Error ? cause.message : "外部发现读取失败" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const aiFeed = Array.isArray(data?.ai) ? data.ai : [];
  const dailyFeed = Array.isArray(data?.daily) ? data.daily : [];
  const xFeed = Array.isArray(data?.x) ? data.x : [];
  const dailyItems = dailyFeed.length ? dailyFeed : aiFeed.filter((item) => isToday(item.publishedAt));
  const xItems = xFeed.filter((item) => isToday(item.publishedAt));
  const allItems = [...dailyItems, ...xItems];
  const visible = allItems.filter((item) => filter === "all" || (filter === "x" ? item.source === "x" : item.category === filter));

  function pick(item: InspireItem, event: React.MouseEvent) {
    event.stopPropagation();
    if (picked.has(item.id)) return;
    addTopic(item.title, []);
    setPicked((current) => new Set(Array.from(current).concat(item.id)));
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">子功能 · 外部发现</p><h2 className="mt-1 text-2xl font-semibold">出去逛一圈，再带回来</h2><p className="mt-1 text-sm text-muted">这里只负责发现。真正留下的内容，仍回到灵感随笔或资源库。</p></div>
        <button onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink-soft disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />刷新</button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((category) => {
          const count = category === "all" ? allItems.length : category === "x" ? xItems.length : dailyItems.filter((item) => item.category === category).length;
          if (category !== "all" && !count) return null;
          return <button key={category} onClick={() => setFilter(category)} className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === category ? "border-terra bg-terra text-white" : "border-line bg-white text-ink-soft"}`}>{LABELS[category]} <span className="opacity-60">{count}</span></button>;
        })}
      </div>

      {loading && !data && <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}</div>}
      {!loading && !visible.length && <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">{data?.error ?? "今天暂时没有新的外部发现"}</div>}

      <div className="space-y-2.5">
        {visible.map((item) => {
          const isExpanded = expanded.has(item.id);
          return (
            <article key={item.id} onClick={() => setExpanded((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })} className="cursor-pointer rounded-2xl border border-line bg-white p-4 transition hover:border-terra/30 hover:shadow-card">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-terra-wash text-xs font-bold text-terra">{item.source === "x" ? "𝕏" : "AI"}</span>
                <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold leading-6">{item.title}</h3>{item.summary && <p className={`mt-1 text-xs leading-5 text-ink-soft ${isExpanded ? "" : "line-clamp-2"}`}>{item.summary}</p>}<p className="mt-2 text-[11px] text-muted">{item.sourceName}</p></div>
                <div className="flex items-center gap-2"><a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} aria-label="查看来源" className="text-muted hover:text-ink"><ExternalLink size={14} /></a><ChevronDown size={14} className={`text-muted transition ${isExpanded ? "rotate-180" : ""}`} /></div>
                <button onClick={(event) => pick(item, event)} disabled={picked.has(item.id)} className="flex-none rounded-lg bg-terra-wash px-3 py-2 text-xs font-semibold text-terra-deep disabled:opacity-50">{picked.has(item.id) ? "已加入" : "变成选题"}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
