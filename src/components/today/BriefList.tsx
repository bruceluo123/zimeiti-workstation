"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useTopicsStore } from "@/store/topics-store";
import type { InspireItem, InspireResponse } from "@/types/inspire";

export function BriefList() {
  const addTopic = useTopicsStore((s) => s.addTopic);
  const [items, setItems] = useState<InspireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inspire")
      .then((r) => r.json() as Promise<InspireResponse>)
      .then((data) => {
        if (cancelled) return;
        // 合并 AI + X，各最多取前 3 条，共 6 条展示
        const merged = [...data.ai.slice(0, 3), ...data.x.slice(0, 3)];
        setItems(merged);
        if (!data.success && data.error) setError(data.error);
      })
      .catch(() => {
        if (!cancelled) setError("网络异常，使用离线示例");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const pick = (item: InspireItem) => {
    if (picked.includes(item.id)) return;
    addTopic(item.title, []);
    setPicked((prev) => [...prev, item.id]);
  };

  // 离线占位
  const display: InspireItem[] = items.length > 0 ? items : [
    { id: "placeholder-1", source: "ai", title: "今日 AI 早报加载中…", summary: "数据正在从 aihot.virxact.com 拉取", url: "#", sourceName: "AI HOT", category: null, publishedAt: null, score: null },
  ];

  return (
    <Card>
      <CardTitle
        action={
          <a href="/inspire" className="cursor-pointer text-[12px] font-medium text-terra hover:underline">
            进灵感库 →
          </a>
        }
      >
        今日早报摘要
      </CardTitle>
      <p className="mb-4 mt-0.5 text-[12.5px] text-muted">
        {loading
          ? "正在从 aihot 拉取 AI 精选…"
          : error
          ? `⚠ ${error}`
          : `aihot 精选 ${items.filter((i) => i.source === "ai").length} 条 · X 精选 ${items.filter((i) => i.source === "x").length} 条`}
      </p>
      <ul className="flex flex-col">
        {display.map((item, i) => (
          <li
            key={item.id}
            className="flex items-start gap-3.5 border-b border-dashed border-line py-3.5 last:border-none last:pb-0"
          >
            <span className="w-[26px] flex-none pt-px font-serif text-[13px] font-semibold text-terra">
              {item.source === "x" ? "𝕏" : `N${String(i + 1).padStart(2, "0")}`}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-medium leading-snug text-ink line-clamp-2">
                {item.title}
              </div>
              {item.summary && (
                <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft line-clamp-2">
                  {item.summary}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="inline-block rounded-[5px] border border-line px-[7px] text-[11px] text-muted">
                  {item.sourceName}
                </span>
                {item.category && (
                  <span className="inline-block rounded-[5px] bg-terra-wash px-[7px] text-[11px] text-terra-deep">
                    {item.category}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => pick(item)}
              disabled={picked.includes(item.id) || item.url === "#"}
              className="flex-none self-center rounded-md border px-[9px] py-1 text-[11px] font-medium transition disabled:cursor-default disabled:opacity-60 border-terra-wash bg-terra-wash text-terra-deep enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white"
            >
              {picked.includes(item.id) ? "已加入 ✓" : "→ 选题"}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
