"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface StoredPost {
  id: string;
  external_id: string;
  source_url: string;
  published_at: string | null;
  body: string;
  media: { media_key: string }[];
  weiboDraftStatus: string | null;
}

const draftStatusText: Record<string, string> = {
  draft: "待初审", needs_review: "待初审", approved: "已通过", scheduled: "已排期",
  publishing: "正在发布", published: "已发布", failed: "发布失败",
  handoff_pending: "手工交接中", reported_published: "手工记录已发布", skipped: "已跳过",
};

export function XReadPanel({
  onDraftCreated,
  onSyncComplete,
  onPostsLoaded,
}: {
  onDraftCreated?: () => void | Promise<void>;
  onSyncComplete?: () => void | Promise<void>;
  onPostsLoaded?: (count: number) => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [needsWorkspaceLogin, setNeedsWorkspaceLogin] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [bearerToken, setBearerToken] = useState("");
  const [working, setWorking] = useState(false);
  const [workingPostId, setWorkingPostId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [connectionResponse, postsResponse] = await Promise.all([
        fetch("/api/x/connection", { cache: "no-store" }),
        fetch("/api/x/posts", { cache: "no-store" }),
      ]);
      const [connection, stored] = await Promise.all([connectionResponse.json(), postsResponse.json()]);
      if (connectionResponse.status === 401 || postsResponse.status === 401) {
        setNeedsWorkspaceLogin(true);
        setConnected(null);
        setReady(null);
        setPosts([]);
        onPostsLoaded?.(0);
        setError("");
        return;
      }
      if (!connectionResponse.ok || !postsResponse.ok) throw new Error(connection.error || stored.error || "读取 X 状态失败");
      setNeedsWorkspaceLogin(false);
      setConnected(connection.connected);
      setReady(connection.ready);
      setLastSyncedAt(connection.lastSyncedAt);
      const nextPosts = stored.posts || [];
      setPosts(nextPosts);
      onPostsLoaded?.(nextPosts.length);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "读取失败"); }
  }, [onPostsLoaded]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/x/connection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearerToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "连接失败");
      setBearerToken("");
      setNotice("只读令牌已加密保存。点击「读取最新帖子」开始首次同步。");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "连接失败"); }
    finally { setWorking(false); }
  }

  async function sync() {
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/x/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "同步失败");
      await refresh();
      await onSyncComplete?.();
      setNotice(`已读取 ${result.imported} 条新帖并加入微博待初审；不会自动排期或发布。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "同步失败"); }
    finally { setWorking(false); }
  }

  async function createWeiboDraft(post: StoredPost) {
    setWorkingPostId(post.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/x/posts/${post.id}/weibo-draft`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "生成微博草稿失败");
      setNotice("已生成一字未改的微博草稿，正在打开微博草稿模块。");
      await refresh();
      await onDraftCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "生成微博草稿失败"); }
    finally { setWorkingPostId(null); }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-terra" /><h2 className="text-lg font-semibold">X 帖子只读同步</h2></div>
          <p className="mt-2 text-sm text-ink-soft">每半小时读取 @Global_Funny_ 的新原创帖；新发现的纯文字帖会自动发布到已连接的微博。首次读取的历史帖和带媒体的帖子仍进入待初审。</p>
          {lastSyncedAt && <p className="mt-2 text-xs text-muted">上次读取：{new Date(lastSyncedAt).toLocaleString("zh-CN")}</p>}
        </div>
        {connected && <button onClick={() => void sync()} disabled={working || !ready} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><RefreshCcw size={16} />{working ? "读取中…" : "读取最新帖子"}</button>}
      </div>
      {needsWorkspaceLogin ? <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>请先登录麦满分工作站，再查看 X 连接状态。</p><Link href="/login" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-terra px-4 font-medium text-white">登录工作站 →</Link></div> : connected === null && <p className="mt-4 text-sm text-muted">正在检查 X 连接…</p>}
      {ready === false && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">服务器尚未配置 X 令牌加密密钥，暂不能保存连接。</p>}
      {connected === false && ready === true && (
        <form onSubmit={connect} className="mt-5">
          <label htmlFor="x-bearer" className="block text-sm font-medium">新 Bearer Token</label>
          <input id="x-bearer" type="password" autoComplete="off" spellCheck={false} required value={bearerToken} onChange={(event) => setBearerToken(event.target.value)}
            placeholder="只在这里粘贴新生成的 Bearer Token" className="mt-2 min-h-11 w-full rounded-xl border border-line bg-bg px-4 text-sm outline-none focus:border-terra" />
          <p className="mt-2 text-xs leading-5 text-muted">不要再截图或发到聊天里；令牌只会传给工作站服务器，并以加密形式保存。X API 读取按返回帖子计费，请先在 X 控制台设置消费上限。</p>
          <button disabled={working} className="mt-3 min-h-11 rounded-xl bg-terra px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{working ? "保存中…" : "保存只读连接"}</button>
        </form>
      )}
      {connected && <p className="mt-3 text-xs text-muted">令牌已加密保存，是否能读取以 X API 实际响应为准。若以后再轮换令牌，可在下方重新保存；保存后将从最新 10 条重新建立同步位置。</p>}
      {connected && (
        <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer">更新 Bearer Token</summary>
          <form onSubmit={connect} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="password" autoComplete="off" spellCheck={false} required aria-label="新的 X Bearer Token" value={bearerToken}
              onChange={(event) => setBearerToken(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm" />
            <button disabled={working} className="min-h-11 rounded-xl border border-terra px-4 text-sm text-terra disabled:opacity-50">替换令牌</button>
          </form>
        </details>
      )}
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{error || notice}</p>}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-base font-semibold">已入库的 X 帖子 <span className="text-sm font-normal text-muted">{posts.length}</span></h3>
        {posts.length === 0 && <p className="mt-3 text-sm text-muted">还没有自动读取的帖子。</p>}
        <div className="mt-3 space-y-3">
          {posts.map((post) => <article key={post.id} className="rounded-xl border border-line bg-bg p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{post.published_at ? new Date(post.published_at).toLocaleString("zh-CN") : "X 帖子"}</span>
              <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-terra">查看原帖 <ArrowUpRight size={13} /></a>
              {post.media?.length > 0 && <span>附带 {post.media.length} 个媒体标识</span>}
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>
            <div className="mt-4">
              {post.weiboDraftStatus ? (
                <span className="inline-flex min-h-10 items-center rounded-xl bg-green-50 px-3 text-xs font-medium text-green-800">已进入微博草稿 · {draftStatusText[post.weiboDraftStatus] || post.weiboDraftStatus}</span>
              ) : (
                <button disabled={workingPostId === post.id} onClick={() => void createWeiboDraft(post)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-terra px-3 text-xs font-medium text-terra disabled:opacity-50">
                  <Send size={14} />{workingPostId === post.id ? "生成中…" : "生成微博原样草稿"}
                </button>
              )}
            </div>
          </article>)}
        </div>
      </div>
    </section>
  );
}
