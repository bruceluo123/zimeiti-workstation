"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listSources, saveSources } from "@/lib/sources/local-db";
import { decodeSourceBundle } from "@/lib/sources/import";
import { PLATFORM_LABELS } from "@/lib/sources/platform";
import { SOURCE_CATEGORIES, type SourceDocument } from "@/types/source";
import { SourceKnowledgePanel } from "@/components/assistant/SourceKnowledgePanel";

const statuses = { collecting: "正在取正文", transcribing: "正在识别口播", captured: "已取得口播", analyzing: "AI 正在整理", ready: "已整理", failed: "需要处理" };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function SourceLibrary({ workspace = false, captureForm, onSourcesChange, onPick, initialSourceId }: {
  workspace?: boolean;
  captureForm?: ReactNode;
  onSourcesChange?: (sources: SourceDocument[]) => void;
  onPick?: (source: SourceDocument) => void;
  initialSourceId?: string;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [scope, setScope] = useState("日常素材");
  const [bookChapter, setBookChapter] = useState("全部章节");
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [url, setUrl] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSourceId);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [local, setLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const importing = useRef<HTMLInputElement>(null);
  const selected = sources.find(s => s.id === selectedId);
  useEffect(() => { onSourcesChange?.(sources); }, [sources, onSourcesChange]);
  function openSource(source: SourceDocument) {
    if (onPick) onPick(source);
    else setSelectedId(source.id);
  }
  async function sendToCodex(source: SourceDocument) {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("title", source.title); form.set("url", source.url || "");
      form.set("text", source.body);
      form.set("librarySourceId", source.id);
      form.set("author", source.author || "");
      const response = await fetch("/api/assistant/sources", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "无法交给 Codex");
      setSelectedId(undefined); router.push(`/assistant?source=${encodeURIComponent(result.id)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "导入失败"); setSelectedId(undefined); }
    finally { setBusy(false); }
  }

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
        const response = await fetch("/api/sources/library", { cache: "no-store" });
        if (response.ok) {
          const incoming = decodeSourceBundle(await response.json());
          if (typeof indexedDB === "undefined") {
            setSources(incoming);
            setLocal(true);
            return;
          }
          const current = new Map((await listSources()).map(source => [source.id, source]));
          await saveSources(incoming.filter(source => {
            const existing = current.get(source.id);
            return !existing || Date.parse(existing.updatedAt) < Date.parse(source.updatedAt);
          }));
          setLocal(true);
        } else setLocal(false);
      }
      setSources(await listSources());
    } catch (cause) { setError(`读取素材库失败，原有内容没有被删除：${cause instanceof Error ? cause.message : "请重试"}`); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!local || !sources.some(s => s.status && !["ready", "captured", "failed"].includes(s.status))) return;
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [local, sources, refresh]);
  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(undefined); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedId]);

  async function collect() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/sources/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "无法启动采集");
      setNotice("已开始采集。文章通常较快，视频需要下载和识别口播；可以继续写作，点刷新查看进度。");
      setUrl(""); window.setTimeout(() => { void refresh(); }, 2000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "采集失败"); }
    finally { setBusy(false); }
  }
  async function retrySource(source: SourceDocument) {
    if (!source.url) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/sources/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: source.url, refresh: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "无法重新读取链接");
      setSources(current => current.map(item => item.id === source.id ? { ...item, status: "collecting", error: undefined } : item));
      setNotice("已重新读取链接。工作站会自动尝试获取视频并识别口播，请稍后查看结果。");
      window.setTimeout(() => { void refresh(); }, 2000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "重新读取失败"); }
    finally { setBusy(false); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("导入文件超过 8 MB，请分批导入");
      const imported = decodeSourceBundle(JSON.parse(await file.text()));
      await saveSources(imported);
      setSources(await listSources()); setNotice(`已导入 ${imported.length} 份素材；相同来源 ID 更新，不重复建立。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "导入失败"); }
  }
  function exportLibrary() {
    const blob = new Blob([JSON.stringify({ version: 1, sources }, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = href; anchor.download = `麦满分素材库-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  const bookChapters = Array.from(new Map(sources.filter(s => s.book).map(s => [s.book!.chapterNumber, s.book!.chapterTitle])).entries()).sort((a, b) => a[0] - b[0]);
  const visible = sources.filter(s => (query.trim() || scope === "全部素材" || (scope === "书籍" ? !!s.book : !s.book)) && (bookChapter === "全部章节" || s.book?.chapterNumber === Number(bookChapter)) && (category === "全部" || (category === "GitHub 项目" ? !!s.repositories?.length : s.analysis?.category === category || s.analysis?.tags.includes(category))) && `${s.title} ${s.body} ${s.book?.chapterTitle || ""} ${s.analysis?.summary || ""} ${s.analysis?.tags.join(" ") || ""}`.toLowerCase().includes(query.toLowerCase()));
  if (scope === "书籍" && !query.trim()) visible.sort((a, b) => (a.book?.chapterNumber || 0) - (b.book?.chapterNumber || 0) || (a.book?.itemNumber || 0) - (b.book?.itemNumber || 0));
  const repositories = visible.flatMap(s => (s.repositories || []).map(repo => ({ ...repo, source: s })));

  return <section className="mb-8 rounded-[22px] border border-line bg-white p-4 sm:p-6">
    {!workspace && <Link href="/write" className="mb-4 inline-flex min-h-10 items-center rounded-xl bg-terra px-4 text-sm font-semibold text-white">边查边写 · 左侧素材，右侧正文 →</Link>}
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold text-terra">原文有出处 · 摘要可检索 · 视频有段落</p><h2 className="mt-1 text-2xl font-semibold">来源资源库</h2><p className="mt-2 text-xs text-muted">外部素材单独存放，不会自动变成你的原创观点。AI 归纳和原文始终分开。</p></div><div className="flex gap-3 text-xs text-terra"><button onClick={refresh} disabled={refreshing}>{refreshing ? "读取中…" : "刷新"}</button><button onClick={() => importing.current?.click()}>导入</button><button onClick={exportLibrary} disabled={!sources.length}>导出备份</button></div></div>
    <input ref={importing} type="file" accept="application/json,.json" className="hidden" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
    <details className="mt-4 rounded-xl border border-line p-3">
      <summary className="cursor-pointer text-sm font-semibold text-terra">添加素材 · 链接 / 粘贴原文</summary>
      {local ? <div className="mt-4 flex gap-2"><input aria-label="采集来源链接" value={url} onChange={e => setUrl(e.target.value)} placeholder="粘贴 X / 小红书 / 抖音 / 公众号 / 微博链接" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-3 text-sm" /><button onClick={collect} disabled={busy || !url.trim()} className="rounded-xl bg-terra px-4 text-sm font-semibold text-white disabled:opacity-40">采集并整理</button></div> : <p className="mt-4 rounded-xl bg-bg p-3 text-xs leading-5 text-muted">已登录浏览器的采集在本机工作站运行。这里可查看当前浏览器素材，或导入本机导出的资源包；尚未启用跨设备自动同步。</p>}
      {captureForm}
      {!captureForm && <Link href="/write" className="mt-3 inline-block text-xs text-terra">粘贴原文并开始写作 →</Link>}
    </details>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-xs leading-5 text-terra">{notice}</p>}
    <div className="my-4 flex flex-wrap gap-2">{["全部", ...SOURCE_CATEGORIES, "GitHub 项目"].map(c => <button key={c} onClick={() => { setCategory(c); setSelectedId(undefined); }} className={`rounded-full border px-3 py-2 text-xs ${category === c ? "border-terra bg-terra text-white" : "border-line"}`}>{c}</button>)}</div>
    {bookChapters.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted"><div className="flex flex-wrap gap-1">{["日常素材", "书籍", "全部素材"].map(item => <button key={item} onClick={() => { setScope(item); setCategory("全部"); setBookChapter("全部章节"); setVisibleLimit(60); }} className={`rounded-full border px-3 py-2 ${scope === item ? "border-terra bg-terra-wash text-terra" : "border-line"}`}>{item === "书籍" ? `书籍 · ${sources.filter(s => !!s.book).length}` : item}</button>)}</div>{scope === "书籍" && <><label htmlFor="book-chapter-filter">章节</label><select id="book-chapter-filter" value={bookChapter} onChange={e => { setBookChapter(e.target.value); setVisibleLimit(60); }} className="max-w-full rounded-xl border border-line bg-white px-3 py-2 text-xs"><option>全部章节</option>{bookChapters.map(([number, title]) => <option key={number} value={number}>第 {number} 节 · {title}</option>)}</select></>}<span>搜索会查全部素材；原书评级不等于独立核验。</span></div>}
    <input aria-label="搜索来源资源" value={query} onChange={e => { setQuery(e.target.value); setVisibleLimit(60); }} placeholder="搜索标题、正文、摘要或标签" className="mb-4 w-full rounded-xl border border-line px-3 py-2 text-sm" />
    {!workspace && <SourceKnowledgePanel sources={visible} />}
    {category === "GitHub 项目" ? <div className={`grid gap-3 ${workspace ? "" : "sm:grid-cols-2"}`}>{repositories.map(repo => <article key={`${repo.source.id}-${repo.url}`} className="rounded-xl border border-line p-4"><a href={repo.url} target="_blank" rel="noreferrer" className="break-all text-sm font-semibold text-terra">{repo.name} ↗</a><p className="mt-2 text-sm leading-6">{repo.purpose}</p><p className="mt-2 text-xs text-muted">许可：{repo.license} · {repo.verified ? "已读取仓库元信息" : "待核实"}</p><button onClick={() => openSource(repo.source)} className="mt-3 text-xs text-terra">查看来源文章与总结 →</button></article>)}</div> : <div className={`grid gap-3 ${workspace ? "" : "sm:grid-cols-2"}`}>{visible.slice(0, visibleLimit).map(source => <button key={source.id} onClick={() => openSource(source)} className={`rounded-xl border p-4 text-left ${selectedId === source.id ? "border-terra bg-terra-wash" : "border-line"}`}><p className="text-[11px] text-terra">{source.book ? `《${source.book.title}》 · 第 ${source.book.chapterNumber} 节 / 第 ${source.book.itemNumber} 条 · 作者评级 ${source.book.grade}` : `${PLATFORM_LABELS[source.platform]} · ${source.analysis?.category || "待分类"} · ${source.status ? statuses[source.status] : "已保存"}`}</p><h3 className="mt-2 text-sm font-semibold leading-6">{source.title}</h3><p className="mt-2 line-clamp-3 text-xs leading-5 text-muted">{source.analysis?.summary || source.book?.lead || source.error || source.body}</p><p className="mt-2 text-[11px] text-terra">{source.analysis?.tags.map(tag => `#${tag}`).join(" ")}</p></button>)}</div>}
    {category !== "GitHub 项目" && visible.length > visibleLimit && <button onClick={() => setVisibleLimit(limit => limit + 60)} className="mt-4 w-full rounded-xl border border-line p-3 text-sm text-terra">显示更多 · 已显示 {visibleLimit} / {visible.length} 条</button>}
    {!visible.length && <p className="py-8 text-center text-sm text-muted">还没有符合条件的素材。先采集或导入一份来源。</p>}
    {selected && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b241e]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(undefined); }}>
        <article role="dialog" aria-modal="true" aria-labelledby="source-detail-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[26px] border border-white/60 bg-white shadow-[0_30px_100px_rgba(8,38,30,.28)] sm:max-h-[88vh] sm:rounded-[26px]">
          <header className="flex flex-none items-start justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0"><p className="text-[11px] font-semibold text-terra">{selected.book ? `书籍 · 第 ${selected.book.chapterNumber} 节 / 第 ${selected.book.itemNumber} 条 · 原文已收录` : `${PLATFORM_LABELS[selected.platform]} · ${selected.analysis?.category || "待分类"} · ${selected.status ? statuses[selected.status] : "已保存"}`}</p><h3 id="source-detail-title" className="mt-1 text-xl font-semibold leading-7 sm:text-2xl">{selected.title}</h3></div>
            <button autoFocus onClick={() => setSelectedId(undefined)} aria-label="关闭素材详情" className="grid h-10 w-10 flex-none place-items-center rounded-full border border-line bg-bg text-2xl leading-none text-muted transition hover:border-terra hover:text-terra">×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
            <div className="mb-5 flex flex-wrap gap-3 text-xs font-semibold text-terra">{selected.url && <a href={selected.url} target="_blank" rel="noreferrer" className="rounded-full bg-terra-wash px-3 py-2">核对原始来源 ↗</a>}{selected.platform === "douyin" && selected.status === "failed" && local && <button disabled={busy} onClick={() => void retrySource(selected)} className="rounded-full border border-terra/25 px-3 py-2 disabled:opacity-50">{busy ? "正在重试…" : "重试读取链接 ↻"}</button>}<Link href={`/write?source=${selected.id}`} className="rounded-full bg-terra px-3 py-2 text-white">带着这份素材写作 →</Link><button disabled={busy || !selected.body.trim()} onClick={() => sendToCodex(selected)} className="rounded-full border border-terra/25 px-3 py-2 disabled:opacity-50">交给本机 Codex 提炼 →</button></div>
            {selected.error && <p className="mb-4 text-sm text-red-700">{selected.error}</p>}
            {selected.book && <div className="mb-5 rounded-2xl bg-terra-wash p-4 sm:p-5"><p className="text-xs font-semibold text-terra">《{selected.book.title}》 / 第 {selected.book.chapterNumber} 节 {selected.book.chapterTitle} / 第 {selected.book.itemNumber} 条</p><p className="mt-2 text-sm leading-7">{selected.book.lead}</p><p className="mt-3 text-xs text-muted">作者评级 {selected.book.grade} · 性价比 {selected.book.ratio} · 来源陈述，尚未独立核验</p>{selected.book.references.length > 0 && <div className="mt-4 border-t border-terra/20 pt-3"><p className="text-xs font-semibold">原书所列文献</p>{selected.book.references.map((ref, i) => <p key={i} className="mt-2 break-words text-xs leading-5">{ref.text}{ref.urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-2 text-terra underline">查看原文 ↗</a>)}</p>)}</div>}</div>}
            {selected.analysis && <div className="space-y-4"><div className="rounded-2xl bg-terra-wash p-4 sm:p-5"><h4 className="text-xs font-semibold text-terra">AI 核心归纳 · {selected.analysis.model}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{selected.analysis.summary}</p></div><ul className="list-disc space-y-2 pl-5 text-sm leading-6">{selected.analysis.keyPoints.map((point,i) => <li key={i}>{point}</li>)}</ul>
              {selected.analysis.segments.map((s,i) => <div key={i} className="rounded-2xl border border-line p-4"><h4 className="text-sm font-semibold text-terra">{s.part} · {time(s.start)}–{time(s.end)}</h4><p className="mt-2 text-sm leading-6">{s.summary}</p><p className="mt-2 text-xs text-muted">表达方法：{s.technique}</p></div>)}
              {selected.analysis.cautions.length > 0 && <div className="rounded-2xl bg-amber-50 p-4 text-xs leading-6 text-amber-900"><b>引用前核对</b>{selected.analysis.cautions.map((c,i) => <p key={i}>{c}</p>)}</div>}
            </div>}
            <details className="mt-5 rounded-2xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold">{selected.transcript ? "查看带时间戳的口播转写（机器识别，待校对）" : "查看留存原文"} · {selected.body.length} 字</summary><div className="mt-4 whitespace-pre-wrap text-sm leading-7">{selected.transcript ? selected.transcript.segments.map((s,i) => <p key={i}><span className="mr-2 text-xs text-muted">{time(s.start)}</span>{s.text}</p>) : selected.body}</div></details>
          </div>
        </article>
      </div>,
      document.body
    )}
  </section>;
}
