"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, CircleAlert, Clock3, Edit3, Link2, Loader2, RefreshCcw, Send, X } from "lucide-react";
import type { MirrorDraft } from "./types";

interface Connection {
  weibo_user_id: string;
  username: string;
  status: string;
  refresh_expires_at: string;
}

interface Authorization {
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresAt: string;
}

interface Props {
  drafts: MirrorDraft[];
  loading: boolean;
  refresh: () => Promise<void>;
  setError: (value: string) => void;
  setNotice: (value: string) => void;
}

const statusLabel: Record<MirrorDraft["status"], string> = {
  draft: "待初审", needs_review: "需人工确认", approved: "已通过", scheduled: "已排期",
  publishing: "正在发布", published: "已发布", failed: "发布失败", handoff_pending: "手工交接中",
  reported_published: "手工记录已发布", skipped: "已跳过",
};

function nextHalfHour(): string {
  const date = new Date(Date.now() + 20 * 60_000);
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "";
}

export function WeiboReviewPanel({ drafts, loading, refresh, setError, setNotice }: Props) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startAt, setStartAt] = useState(nextHalfHour);
  const [intervalMinutes, setIntervalMinutes] = useState(180);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [filter, setFilter] = useState<"review" | "problem" | "scheduled" | "published" | "all">("review");

  const loadConnection = useCallback(async () => {
    const response = await fetch("/api/weibo/connection", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "读取微博连接失败");
    setConnection(result.connected ? result.connection : null);
    setAuthorization(result.authorization || null);
  }, []);

  useEffect(() => { void loadConnection().catch((cause) => setError(cause instanceof Error ? cause.message : "读取微博连接失败")); }, [loadConnection, setError]);

  const reviewable = useMemo(() => drafts.filter((draft) => ["draft", "needs_review", "approved", "failed"].includes(draft.status)), [drafts]);
  const problemCount = useMemo(() => drafts.filter((draft) => draft.publish_attempts > 0 && Boolean(draft.last_error) && draft.status !== "published").length, [drafts]);
  const selectedCount = reviewable.filter((draft) => selected.has(draft.id)).length;
  const visibleDrafts = useMemo(() => drafts.filter((draft) => {
    if (filter === "review") return ["draft", "needs_review", "approved", "failed"].includes(draft.status);
    if (filter === "problem") return draft.publish_attempts > 0 && Boolean(draft.last_error) && draft.status !== "published";
    if (filter === "scheduled") return ["scheduled", "publishing"].includes(draft.status);
    if (filter === "published") return ["published", "reported_published"].includes(draft.status);
    return true;
  }), [drafts, filter]);

  async function startConnection() {
    setConnecting(true); setError(""); setNotice("");
    const popup = window.open("about:blank", "_blank");
    try {
      const response = await fetch("/api/weibo/connection", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "发起微博授权失败");
      setAuthorization(result);
      if (popup) { popup.opener = null; popup.location.href = result.verificationUrl; }
      else window.open(result.verificationUrl, "_blank", "noopener,noreferrer");
      setNotice(`微博授权页已打开，确认授权后回到这里点“我已授权”。验证码：${result.userCode}`);
    } catch (cause) {
      popup?.close();
      setError(cause instanceof Error ? cause.message : "发起微博授权失败");
    } finally { setConnecting(false); }
  }

  async function confirmConnection() {
    setConnecting(true); setError("");
    try {
      const response = await fetch("/api/weibo/connection/poll", { method: "POST" });
      const result = await response.json();
      if (response.status === 202) { setNotice("微博仍在等待你确认授权，请在授权页完成后再点一次。"); return; }
      if (!response.ok) throw new Error(result.error || "确认微博授权失败");
      setAuthorization(null);
      await loadConnection();
      setNotice(`微博 @${result.connection.username} 已连接；此后自动读取的新纯文字 X 帖会直接尝试发布。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "确认微博授权失败"); }
    finally { setConnecting(false); }
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => reviewable.every((draft) => current.has(draft.id))
      ? new Set()
      : new Set(reviewable.map((draft) => draft.id)));
  }

  async function scheduleSelected() {
    const chosen = reviewable.filter((draft) => selected.has(draft.id));
    if (!connection) { setError("请先连接微博正式服务"); return; }
    if (!chosen.length) { setError("请先勾选要发布的草稿"); return; }
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) { setError("请选择有效的开始时间"); return; }
    const end = new Date(start.getTime() + (chosen.length - 1) * intervalMinutes * 60_000);
    const confirmed = window.confirm(
      `将 ${chosen.length} 条内容排期发布到微博 @${connection.username}\n` +
      `开始：${formatDate(start.toISOString())}\n结束：${formatDate(end.toISOString())}\n` +
      `间隔：${intervalMinutes === 30 ? "半小时" : `${intervalMinutes / 60} 小时`}，预计消耗 ${chosen.length * 15}C。\n\n确认后，到点将由工作站自动发布。`
    );
    if (!confirmed) return;
    setWorkingId("schedule"); setError(""); setNotice("");
    try {
      const items = chosen.map((draft, index) => ({ id: draft.id, scheduledAt: new Date(start.getTime() + index * intervalMinutes * 60_000).toISOString() }));
      const response = await fetch("/api/weibo/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "安排发布失败");
      setSelected(new Set()); setFilter("scheduled");
      await refresh();
      setNotice(`已排期 ${result.scheduled} 条，预计消耗 ${result.estimatedCredits}C；到点自动发布。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "安排发布失败"); }
    finally { setWorkingId(null); }
  }

  async function saveEdit(draft: MirrorDraft) {
    setWorkingId(draft.id); setError("");
    try {
      const response = await fetch(`/api/originals/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit", body: editingBody }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存修改失败");
      setEditingId(null); await refresh(); setNotice("修改已保存，这条内容仍需你勾选并确认排期。 ");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存修改失败"); }
    finally { setWorkingId(null); }
  }

  async function unschedule(draft: MirrorDraft) {
    if (!window.confirm(`取消 ${formatDate(draft.scheduled_at)} 的发布排期？`)) return;
    setWorkingId(draft.id); setError("");
    try {
      const response = await fetch(`/api/originals/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unschedule" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "取消排期失败");
      await refresh(); setNotice("已取消排期，内容退回初审队列。 ");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "取消排期失败"); }
    finally { setWorkingId(null); }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Link2 size={18} className="text-terra" /><h2 className="text-lg font-semibold">微博正式服务</h2></div>
            {connection ? (
              <p className="mt-2 text-sm text-ink-soft"><span className="font-medium text-green-700">已连接</span> · @{connection.username} · UID {connection.weibo_user_id}</p>
            ) : <p className="mt-2 text-sm text-ink-soft">连接后，自动读取的新纯文字 X 帖会直接尝试发布；其他草稿仍需初审。</p>}
          </div>
          {!connection && <button onClick={() => void startConnection()} disabled={connecting} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}连接微博</button>}
        </div>
        {authorization && !connection && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
            <p>授权验证码：<strong className="tracking-wider">{authorization.userCode}</strong></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={authorization.verificationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 bg-white px-3">打开微博授权页</a>
              <button onClick={() => void confirmConnection()} disabled={connecting} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-800 px-3 text-white disabled:opacity-60">{connecting && <Loader2 size={15} className="animate-spin" />}我已授权</button>
            </div>
          </div>
        )}
        <div className="mt-4 grid gap-2 border-t border-line pt-4 text-xs text-muted sm:grid-cols-3">
          <span>每半小时读取 X，新纯文字帖直接尝试发布</span><span>每 5 分钟检查到期发布</span><span>纯文字发布预计 15C/条</span>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-semibold">初审与排期</h2><p className="mt-1 text-xs text-muted">先勾选确认，再一次安排；未勾选的内容不会发布。</p></div>
          <button onClick={() => void refresh()} aria-label="刷新草稿" className="rounded-lg p-2 text-ink-soft hover:bg-surface-2"><RefreshCcw size={17} /></button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <label className="text-xs text-muted">首条发布时间<input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink" /></label>
          <label className="text-xs text-muted">发布间隔<select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-line px-3 text-sm text-ink"><option value={30}>半小时</option><option value={60}>1 小时</option><option value={120}>2 小时</option><option value={180}>3 小时</option><option value={240}>4 小时</option></select></label>
          <button onClick={() => void scheduleSelected()} disabled={workingId === "schedule" || selectedCount === 0 || !connection} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-terra px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><CalendarClock size={16} />确认并一键排期 {selectedCount ? `(${selectedCount})` : ""}</button>
        </div>
        {selectedCount > 0 && <p className="mt-2 text-xs text-muted">预计消耗 {selectedCount * 15}C；发布前会弹出最终确认。</p>}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-1">
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          {([['review', `待初审 ${reviewable.length}`], ['problem', `发布未成功 ${problemCount}`], ['scheduled', '已排期'], ['published', '已发布'], ['all', '全部']] as const).map(([value, text]) => <button key={value} onClick={() => { setFilter(value); setSelected(new Set()); }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${filter === value ? "bg-white text-ink shadow-sm" : value === "problem" && problemCount > 0 ? "text-red-700" : "text-muted"}`}>{text}</button>)}
        </div>
        {(filter === "review" || filter === "all") && reviewable.length > 0 && <button type="button" onClick={toggleAll} className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-terra hover:bg-white">{selectedCount === reviewable.length ? "取消全选" : "全选"}</button>}
      </div>

      {loading && <p className="rounded-xl border border-line bg-white p-6 text-sm text-muted">正在读取…</p>}
      {!loading && visibleDrafts.length === 0 && <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-muted">这个队列还是空的。</p>}
      <div className="space-y-3">
        {visibleDrafts.map((draft) => {
          const canReview = ["draft", "needs_review", "approved", "failed"].includes(draft.status);
          const isEditing = editingId === draft.id;
          return (
            <article key={draft.id} className={`rounded-2xl border bg-white p-5 shadow-sm md:p-6 ${selected.has(draft.id) ? "border-terra ring-1 ring-terra/20" : "border-line"}`}>
              <div className="flex items-start gap-3">
                {canReview && <button onClick={() => toggle(draft.id)} aria-label={selected.has(draft.id) ? "取消选择" : "选择草稿"} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${selected.has(draft.id) ? "border-terra bg-terra text-white" : "border-line bg-white"}`}>{selected.has(draft.id) && <Check size={15} />}</button>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className={`rounded-full px-2.5 py-1 font-medium ${draft.status === "published" ? "bg-green-50 text-green-800" : draft.status === "failed" || draft.status === "needs_review" ? "bg-red-50 text-red-700" : "bg-terra-wash text-terra-deep"}`}>{statusLabel[draft.status]}</span>
                    {draft.scheduled_at && <span className="inline-flex items-center gap-1"><Clock3 size={13} />{formatDate(draft.scheduled_at)}</span>}
                    {!draft.scheduled_at && <span>{formatDate(draft.created_at)}</span>}
                    {draft.publish_attempts > 0 && <span>尝试 {draft.publish_attempts} 次</span>}
                  </div>
                  {draft.last_error && <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"><CircleAlert size={15} className="mt-0.5 shrink-0" />{draft.last_error}</p>}
                  {isEditing ? <textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} maxLength={20000} className="mt-4 min-h-40 w-full rounded-xl border border-terra bg-bg px-4 py-3 text-sm leading-7 outline-none" /> : <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7">{draft.body}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {draft.content_sources?.source_url && <a className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-xs text-terra" target="_blank" rel="noopener noreferrer" href={draft.content_sources.source_url}>查看 X 原帖 <ArrowUpRight size={13} /></a>}
                    {canReview && !isEditing && <button onClick={() => { setEditingId(draft.id); setEditingBody(draft.body); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-xs"><Edit3 size={14} />编辑</button>}
                    {isEditing && <><button onClick={() => void saveEdit(draft)} disabled={workingId === draft.id} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-terra px-3 text-xs text-white"><Check size={14} />保存</button><button onClick={() => setEditingId(null)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line px-3 text-xs"><X size={14} />取消</button></>}
                    {draft.status === "scheduled" && <button onClick={() => void unschedule(draft)} disabled={workingId === draft.id} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-xs text-ink-soft">取消排期</button>}
                    {draft.published_url && <a href={draft.published_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 text-xs text-green-800">查看微博 <ArrowUpRight size={13} /></a>}
                    <Link href={`/video?source=${draft.source_id}`} className="ml-auto inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-xs text-ink-soft">拍成视频 →</Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="text-xs leading-6 text-muted"><Send size={13} className="mr-1 inline" />自动读取的新纯文字 X 帖会原样发往已连接的微博；历史帖、带媒体帖和手动导入内容仍需初审。AI 改写内容必须在后续标为 AI 生成。</p>
    </section>
  );
}
