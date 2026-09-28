"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CloudUpload } from "lucide-react";

interface LocalItem { kind: "thought" | "topic"; payload: Record<string, unknown> }
interface SavedItem { kind: "thought" | "topic"; legacy_id: string; payload: Record<string, unknown>; imported_at: string }

function readLocalItems(): LocalItem[] {
  const result: LocalItem[] = [];
  for (const [key, field, kind] of [
    ["zmt-thoughts", "thoughts", "thought"],
    ["zmt-topics", "topics", "topic"],
  ] as const) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      const records = parsed?.state?.[field];
      if (Array.isArray(records)) {
        for (const payload of records) {
          if (payload && typeof payload === "object" && typeof payload.id === "string") result.push({ kind, payload });
        }
      }
    } catch {
      // 旧浏览器缓存损坏时，不把错误数据当成空记录写到云端。
    }
  }
  return result;
}

export function LegacyBackupPage() {
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/legacy-import", { cache: "no-store" });
    if (!response.ok) { setMessage("无法读取云端备份，请确认已登录管理员账号。"); return; }
    const result = await response.json();
    setSavedItems(result.items ?? []);
  }, []);

  useEffect(() => {
    setLocalItems(readLocalItems());
    void refresh();
  }, [refresh]);

  async function backup() {
    setWorking(true); setMessage("");
    try {
      const chunks: LocalItem[][] = [];
      let current: LocalItem[] = [];
      let size = 20;
      for (const item of localItems) {
        const itemSize = JSON.stringify(item).length + 2;
        if (itemSize > 800_000) throw new Error("有一条旧内容超过单次安全备份大小，需要单独处理；原数据未删除。");
        if (current.length >= 50 || size + itemSize > 800_000) {
          chunks.push(current); current = []; size = 20;
        }
        current.push(item); size += itemSize;
      }
      if (current.length) chunks.push(current);
      let accepted = 0;
      for (const chunk of chunks) {
        const response = await fetch("/api/legacy-import", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: chunk }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "备份失败");
        accepted += result.accepted;
      }
      setMessage(`已检查 ${accepted} 条旧内容；相同版本不会重复保存。旧浏览器数据未被删除。`);
      await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "备份失败"); }
    finally { setWorking(false); }
  }

  return (
    <div className="mx-auto max-w-[850px] px-5 pb-16 pt-8 md:px-10">
      <Link href="/content" className="inline-flex items-center gap-1 text-sm text-terra"><ArrowLeft size={15} />返回内容库</Link>
      <h1 className="mt-5 text-[28px] font-semibold">旧内容备份</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">当前浏览器里的想法和选题仍可在旧页面使用。先把它们只读保存到你的独立空间；这一步不会删除、覆盖或自动发布任何内容。</p>
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 md:p-6">
        <p className="text-sm">此设备找到 <b>{localItems.filter((item) => item.kind === "thought").length}</b> 条想法、<b>{localItems.filter((item) => item.kind === "topic").length}</b> 条选题。</p>
        <p className="mt-1 text-xs text-muted">其他手机或电脑若有未同步的旧草稿，请在那台设备也打开此页备份一次。</p>
        <button onClick={() => void backup()} disabled={working || localItems.length === 0} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><CloudUpload size={17} />{working ? "正在备份…" : "把此设备旧内容备份到云端"}</button>
        {message && <p role="status" className="mt-3 text-sm text-ink-soft">{message}</p>}
      </div>
      <h2 className="mt-9 text-xl font-semibold">最近备份版本 <span className="text-sm font-normal text-muted">{savedItems.length}</span></h2>
      <p className="mt-1 text-xs text-muted">下方是最近 200 个版本的只读快照；相同 ID 如果有不同版本会分别保留，稍后再做冲突合并。</p>
      <div className="mt-4 space-y-3">
        {savedItems.map((item, index) => (
          <article key={`${item.kind}-${item.legacy_id}-${index}`} className="rounded-xl border border-line bg-white p-4">
            <div className="mb-1 text-xs text-muted">{item.kind === "thought" ? "想法" : "选题"} · {new Date(item.imported_at).toLocaleString("zh-CN")}</div>
            <p className="break-words text-sm font-medium">{String(item.payload.title || item.payload.content || "未命名内容")}</p>
            {item.kind === "topic" && typeof item.payload.stage === "string" && <p className="mt-1 text-xs text-muted">旧阶段：{item.payload.stage}</p>}
          </article>
        ))}
        {savedItems.length === 0 && <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">还没有备份。此设备原数据仍在。</p>}
      </div>
    </div>
  );
}
