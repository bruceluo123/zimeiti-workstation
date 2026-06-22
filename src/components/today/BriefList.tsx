"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useTopicsStore } from "@/store/topics-store";
import type { InspireItem, InspireResponse } from "@/types/inspire";

export function BriefList() {
  const addTopic = useTopicsStore((s) => s.addTopic);
  const [daily, setDaily] = useState<InspireItem[]>([]);
  const [x, setX] = useState<InspireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/inspire")
      .then((r) => r.json() as Promise<InspireResponse>)
      .then((data) => {
        if (cancelled) return;
        // 优先用日报（更结构化），日报为空时回落到精选
        const briefItems = data.daily.length > 0 ? data.daily : data.ai;
        setDaily(briefItems.slice(0, 5));
        setX(data.x.slice(0, 3));
        if (!data.success && data.error) setError(data.error);
      })
      .catch(() => {
        if (!cancelled) setError("网络异常");
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

  const allItems = [...daily, ...x];

  const display: InspireItem[] = allItems.length > 0 ? allItems : [
    { id: "placeholder-1", source: "ai", title: "今日 AI 早报加载中…", summary: "9 点自动拉取，首次访问需稍等", url: "#", sourceName: "AI HOT", category: null, publishedAt: null, score: null },
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
          ? "正在从 aihot 拉取今日日报…"
          : error
          ? `⚠ ${error}`
          : `日报 ${daily.length} 条${x.length > 0 ? ` · X 精选 ${x.length} 条` : ""}`}
      </p>
      <ul className="flex flex-col">
        {display.map((item, i) => (
          <li
            key={item.id}
            className="flex items-start gap-3.5 border-b border-line py-3 last:border-none last:pb-0"
          >
            <span className="w-5 flex-none pt-0.5 text-[11px] font-semibold text-terra tabular-nums">
              {item.source === "x" ? "𝕏" : String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium leading-snug text-ink line-clamp-2">
                {item.title}
              </div>
              {item.summary && (
                <div className="mt-0.5 text-[12px] leading-relaxed text-ink-soft line-clamp-2">
                  {item.summary}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => pick(item)}
              disabled={picked.includes(item.id) || item.url === "#"}
              className="flex-none self-center rounded-[5px] border border-terra-wash bg-terra-wash px-[9px] py-1 text-[11px] font-medium text-terra-deep transition disabled:cursor-default disabled:opacity-50 enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white"
            >
              {picked.includes(item.id) ? "✓" : "选题"}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
