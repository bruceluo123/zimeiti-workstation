"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Send, Twitter } from "lucide-react";
import { isAuthRequired, isSupabaseConfigured } from "@/lib/supabase/config";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { XReadPanel } from "./XReadPanel";
import { WeiboReviewPanel } from "./WeiboReviewPanel";
import type { MirrorDraft } from "./types";

type ContentModule = "x" | "weibo";

export function OriginalContentPage() {
  const [drafts, setDrafts] = useState<MirrorDraft[]>([]);
  const [activeModule, setActiveModule] = useState<ContentModule>("x");
  const [xPostCount, setXPostCount] = useState(0);
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setError("");
    try {
      const response = await fetch("/api/originals", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取失败");
      setDrafts(result.drafts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkingId("new"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/originals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, sourceUrl: sourceUrl.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      setBody(""); setSourceUrl("");
      setNotice("原文已保存，微博草稿一字未改。手动录入的正文尚未与 X 原帖自动核对。");
      await refresh();
      setActiveModule("weibo");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setWorkingId(null);
    }
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.href = "/login";
  }

  const showWeiboDrafts = useCallback(async () => {
    await refresh();
    setActiveModule("weibo");
  }, [refresh]);

  return (
    <div className="mx-auto max-w-[920px] px-5 pb-16 pt-7 md:px-10 md:pt-9">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[2px] text-terra">我的原创</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight">一条原文，接着创作</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">X 仍在原生 App 日更。工作站每半小时只读抓取新帖；新纯文字帖直接尝试发布到微博，历史帖和带媒体帖保留初审。</p>
        </div>
        {isSupabaseConfigured() && isAuthRequired() && <button onClick={signOut} className="rounded-lg border border-line px-3 py-2 text-xs text-ink-soft">退出登录</button>}
      </div>

      {!isSupabaseConfigured() ? (
        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm">专属数据库尚未配置，无法跨手机和电脑保存原文。</div>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-sm" role="tablist" aria-label="原创内容模块">
            <button
              type="button"
              role="tab"
              id="content-module-x-tab"
              aria-controls="content-module-panel"
              aria-selected={activeModule === "x"}
              onClick={() => setActiveModule("x")}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${activeModule === "x" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:bg-surface-2"}`}
            >
              <Twitter size={17} aria-hidden="true" />
              <span>X 帖子</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeModule === "x" ? "bg-white/20 text-white" : "bg-surface-2 text-muted"}`}>{xPostCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="content-module-weibo-tab"
              aria-controls="content-module-panel"
              aria-selected={activeModule === "weibo"}
              onClick={() => setActiveModule("weibo")}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${activeModule === "weibo" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:bg-surface-2"}`}
            >
              <Send size={17} aria-hidden="true" />
              <span>微博草稿</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeModule === "weibo" ? "bg-white/20 text-white" : "bg-surface-2 text-muted"}`}>{drafts.length}</span>
            </button>
          </div>

          <div
            id="content-module-panel"
            className="mt-4"
            role="tabpanel"
            aria-labelledby={activeModule === "x" ? "content-module-x-tab" : "content-module-weibo-tab"}
          >
            {activeModule === "x" ? (
              <div className="space-y-4">
                <XReadPanel onDraftCreated={showWeiboDrafts} onSyncComplete={refresh} onPostsLoaded={setXPostCount} />
                <details className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-soft">没有同步到？手动存一条</summary>
                  <form onSubmit={save} className="mt-5">
                    <p className="text-xs text-muted">手动过渡入口；原文只做保存，不会自动发到微博。</p>
                    <label htmlFor="original-body" className="mt-4 block text-sm font-medium">X 原文</label>
                    <textarea id="original-body" required maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="粘贴你已经发出的完整原文，换行和表情都会保留" className="mt-2 min-h-40 w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-terra" />
                    <label htmlFor="original-url" className="mt-3 block text-sm font-medium">这条 X 的链接 <span className="font-normal text-muted">（可选，用于防重复）</span></label>
                    <input id="original-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://x.com/Global_Funny_/status/..." className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:border-terra" />
                    <button disabled={workingId === "new"} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"><Send size={16} />{workingId === "new" ? "保存中…" : "保存并生成微博原样草稿"}</button>
                  </form>
                </details>
              </div>
            ) : <WeiboReviewPanel drafts={drafts} loading={loading} refresh={refresh} setError={setError} setNotice={setNotice} />}
          </div>
        </>
      )}
      {(error || notice) && <div role={error ? "alert" : "status"} className={`fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-lg rounded-xl px-4 py-3 text-sm shadow-lg md:bottom-6 ${error ? "bg-red-50 text-red-800" : "bg-terra-deep text-white"}`}>{error || notice}</div>}
    </div>
  );
}
