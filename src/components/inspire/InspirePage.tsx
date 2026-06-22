"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { useTopicsStore } from "@/store/topics-store";
import type { InspireCategory, InspireItem, InspireResponse } from "@/types/inspire";
import { CATEGORY_LABEL } from "@/types/inspire";
import { PageHeader } from "@/components/ui/PageHeader";

const ALL_CATS: (InspireCategory | "all" | "x")[] = [
  "all", "ai-models", "ai-products", "industry", "tip", "paper", "x",
];
const CAT_LABEL: Record<string, string> = {
  all: "全部",
  x: "𝕏 推文",
  ...CATEGORY_LABEL,
};

export function InspirePage() {
  const addTopic = useTopicsStore((s) => s.addTopic);
  const [data, setData] = useState<InspireResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    fetch("/api/inspire")
      .then((r) => r.json() as Promise<InspireResponse>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const allItems: InspireItem[] = data ? [...data.ai, ...data.x] : [];

  const visible = allItems.filter((it) => {
    if (filter === "all") return true;
    if (filter === "x") return it.source === "x";
    return it.category === filter;
  });

  const pick = (item: InspireItem) => {
    if (picked.has(item.id)) return;
    addTopic(item.title, []);
    setPicked((prev) => new Set(Array.from(prev).concat(item.id)));
  };

  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="INSPIRE"
        title="灵感库"
        sub="AI 精选 · X 关注 · 每条都有「→ 选题」"
        action={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-soft transition hover:border-terra hover:text-terra disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {loading ? "拉取中…" : "刷新"}
          </button>
        }
      />

      {/* 分类筛选条 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {ALL_CATS.map((cat) => {
          const count =
            cat === "all"
              ? allItems.length
              : cat === "x"
              ? allItems.filter((i) => i.source === "x").length
              : allItems.filter((i) => i.category === cat).length;
          if (cat !== "all" && count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition ${
                filter === cat
                  ? "border-terra bg-terra text-white"
                  : "border-line bg-surface text-ink-soft hover:border-terra hover:text-terra"
              }`}
            >
              {CAT_LABEL[cat] ?? cat}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* 内容列表 */}
      {loading && !data && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-[14px] bg-surface-2" />
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <p className="py-16 text-center text-[14px] text-muted">
          {data?.error ?? "暂无数据，点击「刷新」重试"}
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="group flex items-start gap-4 rounded-[14px] border border-line bg-surface p-4 transition hover:border-terra/30 hover:shadow-card"
          >
            {/* 来源标记 */}
            <div className="flex-none pt-0.5">
              {item.source === "x" ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e6eef2] text-[13px] font-bold text-[#2b5a6e]">
                  𝕏
                </span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-terra-wash font-serif text-[12px] font-semibold text-terra">
                  AI
                </span>
              )}
            </div>

            {/* 主内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold leading-snug text-ink line-clamp-2 flex-1">
                  {item.title}
                </h3>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-none opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                >
                  <ExternalLink size={14} className="text-ink-soft" />
                </a>
              </div>
              {item.summary && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft line-clamp-2">
                  {item.summary}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-[11.5px] text-muted">{item.sourceName}</span>
                {item.category && (
                  <span className="rounded-[5px] border border-line px-[7px] py-px text-[11px] text-muted">
                    {CATEGORY_LABEL[item.category]}
                  </span>
                )}
                {item.publishedAt && (
                  <span className="text-[11.5px] text-muted">
                    {new Date(item.publishedAt).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* 选题按钮 */}
            <button
              type="button"
              onClick={() => pick(item)}
              disabled={picked.has(item.id)}
              className="flex-none self-center rounded-lg border px-3 py-1.5 text-[12px] font-medium transition disabled:cursor-default disabled:opacity-50 border-terra-wash bg-terra-wash text-terra-deep enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white"
            >
              {picked.has(item.id) ? "已加入 ✓" : "→ 选题"}
            </button>
          </li>
        ))}
      </ul>

      {data && (
        <p className="mt-8 text-center text-[11.5px] text-muted">
          数据更新于 {new Date(data.fetchedAt).toLocaleTimeString("zh-CN")} · 来源 aihot.virxact.com
        </p>
      )}
    </div>
  );
}
