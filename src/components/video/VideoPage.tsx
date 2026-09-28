"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, CirclePause, CirclePlay, Clapperboard, Sparkles, X } from "lucide-react";

interface Original { id: string; source_id: string; revision_id: string; body: string; created_at: string }
interface Brief {
  id: string; source_id: string; revision_id: string; title: string; script: string;
  shooting_notes: string; review_notes: string; status: "draft" | "ready";
  created_at: string; updated_at: string;
}

export function VideoPage() {
  const [originals, setOriginals] = useState<Original[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(34);
  const [speed, setSpeed] = useState(28);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const [originalResponse, briefResponse] = await Promise.all([
      fetch("/api/originals", { cache: "no-store" }),
      fetch("/api/video-briefs", { cache: "no-store" }),
    ]);
    const [originalResult, briefResult] = await Promise.all([originalResponse.json(), briefResponse.json()]);
    if (!originalResponse.ok || !briefResponse.ok) throw new Error(originalResult.error || briefResult.error || "读取失败");
    setOriginals(originalResult.drafts ?? []);
    setBriefs(briefResult.briefs ?? []);
  }, []);

  useEffect(() => {
    setSourceId(new URLSearchParams(window.location.search).get("source") || "");
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "读取失败"));
  }, [refresh]);

  useEffect(() => {
    const current = briefs.find((brief) => brief.id === selectedId);
    if (current) { setTitle(current.title); setScript(current.script); }
  }, [briefs, selectedId]);

  useEffect(() => {
    if (!promptOpen || !playing) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      if (last) scrollRef.current?.scrollBy(0, (time - last) * speed / 1000);
      last = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [promptOpen, playing, speed]);

  useEffect(() => {
    if (!promptOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setPromptOpen(false); setPlaying(false); }
      if (event.code === "Space" && event.target === document.body) { event.preventDefault(); setPlaying((value) => !value); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [promptOpen]);

  const chosen = briefs.find((brief) => brief.id === selectedId);
  const currentOriginal = originals.find((item) => item.source_id === sourceId);
  const fromSource = currentOriginal
    ? briefs.find((brief) => brief.source_id === sourceId && brief.revision_id === currentOriginal.revision_id)
    : null;

  async function generate() {
    const original = originals.find((item) => item.source_id === sourceId);
    if (!original || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/video-briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId, revisionId: original.revision_id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "生成失败");
      await refresh();
      setSelectedId(result.id);
      setNotice(result.alreadyExists ? "已打开这条原文对应的拍摄稿。" : "拍摄初稿已保存。录制前请核对事实和表达。 ");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "生成失败"); }
    finally { setBusy(false); }
  }

  async function save(status: "draft" | "ready") {
    if (!chosen || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/video-briefs/${chosen.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, script, status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      await refresh();
      setNotice(status === "ready" ? "已标记为可以拍摄，打开提词即可开始。" : "修改已保存。 ");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  }

  function openPrompt() {
    setPlaying(false); setPromptOpen(true);
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
  }

  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-28 pt-7 md:px-10 md:pt-9">
      <Link href="/content" className="inline-flex items-center gap-1 text-xs text-muted hover:text-terra"><ArrowLeft size={14} />返回内容库</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-5 border-b border-line pb-7">
        <div><p className="text-xs font-semibold tracking-[2px] text-terra">一条原文 · 一份拍摄初稿</p><h1 className="mt-2 font-serif text-[34px] leading-tight md:text-[46px]">把想法讲出来</h1><p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">挑一条自己的内容，生成能直接念的稿。想改就改，准备好再打开手机提词。</p></div>
        <span className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">仅生成草稿 · 不会自动发布</span>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <section aria-label="选择原文" className="rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center gap-2"><Clapperboard size={18} className="text-terra" /><h2 className="font-semibold">从哪条开始</h2></div>
          <p className="mt-2 text-xs leading-5 text-muted">你存在“我的内容”的原文会在这里出现。</p>
          <label className="mt-6 block text-xs font-medium text-ink-soft" htmlFor="source-select">选择本人原创</label>
          <div className="relative mt-2"><select id="source-select" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setSelectedId(""); }} className="min-h-12 w-full appearance-none rounded-xl border border-line bg-bg px-3 pr-9 text-sm outline-none focus:border-terra"><option value="">请选择一条</option>{originals.map((item) => <option key={item.id} value={item.source_id}>{item.body.replace(/\s+/g, " ").slice(0, 45)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-4 text-muted" size={16} /></div>
          {sourceId && <p className="mt-4 line-clamp-5 whitespace-pre-wrap break-words border-l-2 border-terra/50 pl-3 text-xs leading-6 text-ink-soft">{originals.find((item) => item.source_id === sourceId)?.body}</p>}
          <button onClick={() => void generate()} disabled={!sourceId || busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-terra px-4 text-sm font-medium text-white disabled:opacity-50"><Sparkles size={16} />{busy ? "处理中…" : fromSource ? "打开这条拍摄稿" : briefs.some((brief) => brief.source_id === sourceId) ? "根据新版原文生成稿" : "生成拍摄初稿"}</button>
          <p className="mt-4 text-xs leading-5 text-muted">脚本生成会调用已配置的 AI 服务；短原文会保持短稿，不补造经历和数据。</p>
          <Link href="/content" className="mt-4 inline-block text-xs text-terra">没有原文？先存一条 →</Link>
        </section>

        <section aria-label="拍摄稿" className="min-h-[420px] rounded-2xl border border-line bg-white p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold tracking-[1.5px] text-terra">拍摄稿</p><h2 className="mt-1 text-xl font-semibold">{chosen ? "这条可以接着拍" : "已保存的稿子"}</h2></div>{chosen && <span className="rounded-full bg-terra-wash px-3 py-1 text-xs text-terra-deep">{chosen.status === "ready" ? "可以拍摄" : "待核对"}</span>}</div>
          {!chosen && briefs.length > 0 && <div className="mt-6 space-y-2">{briefs.map((brief) => <button key={brief.id} onClick={() => { setSelectedId(brief.id); setSourceId(brief.source_id); }} className="flex w-full items-center justify-between rounded-xl border border-line p-4 text-left text-sm hover:border-terra/50"><span className="line-clamp-1 font-medium">{brief.title}</span><span className="ml-3 shrink-0 text-xs text-muted">{brief.status === "ready" ? "可拍" : "草稿"}</span></button>)}</div>}
          {!chosen && briefs.length === 0 && <div className="mt-10 rounded-xl border border-dashed border-line px-5 py-14 text-center text-sm text-muted">先选一条原文，不必维护复杂的创作看板。</div>}
          {chosen && <div className="mt-6 space-y-5">
            <div><label htmlFor="video-title" className="text-xs font-medium text-muted">标题</label><input id="video-title" maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-base font-semibold outline-none focus:border-terra" /></div>
            <div><label htmlFor="video-script" className="text-xs font-medium text-muted">口播台词 · 可直接修改</label><textarea id="video-script" maxLength={20000} value={script} onChange={(event) => setScript(event.target.value)} className="mt-2 min-h-[300px] w-full resize-y rounded-xl border border-line bg-bg px-4 py-4 text-[15px] leading-8 outline-none focus:border-terra" /></div>
            {(chosen.review_notes || chosen.shooting_notes) && <div className="rounded-xl bg-terra-wash/60 p-4 text-sm leading-6 text-ink-soft">{chosen.review_notes && <p><b className="text-ink">录前核对：</b>{chosen.review_notes}</p>}{chosen.shooting_notes && <p className={chosen.review_notes ? "mt-2" : ""}><b className="text-ink">拍摄提示：</b>{chosen.shooting_notes}</p>}</div>}
            <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void save("draft")} className="min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-50">保存修改</button><button disabled={busy} onClick={() => void save("ready")} className="min-h-11 rounded-xl border border-terra px-4 text-sm font-medium text-terra disabled:opacity-50">核对完，可以拍</button><button onClick={openPrompt} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-white"><CirclePlay size={16} />打开手机提词</button></div>
            <p className="text-xs text-muted">提词使用当前屏幕上的台词；刚修改过时请先点“保存修改”。原文会保留，不会被这份稿覆盖。</p>
          </div>}
        </section>
      </div>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-xl p-4 text-sm ${error ? "bg-red-50 text-red-800" : "bg-terra-wash text-terra-deep"}`}>{error || notice}</p>}

      {promptOpen && <div role="dialog" aria-modal="true" aria-label="手机提词器" className="fixed inset-0 z-50 flex flex-col bg-[#101614] text-white">
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-4"><span className="max-w-[70%] truncate text-sm font-medium">{title}</span><button aria-label="关闭提词" onClick={() => { setPromptOpen(false); setPlaying(false); }} className="rounded-full p-2 hover:bg-white/10"><X size={22} /></button></div>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-[50vh] pt-[28vh] md:px-[18vw]"><p style={{ fontSize }} className="whitespace-pre-wrap break-words font-medium leading-[1.7] tracking-wide">{script}</p></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-white/15 bg-[#17201c] px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm"><div className="flex items-center gap-2"><button aria-label="缩小字号" onClick={() => setFontSize((size) => Math.max(22, size - 4))} className="rounded-lg border border-white/20 px-3 py-2">A−</button><button aria-label="放大字号" onClick={() => setFontSize((size) => Math.min(58, size + 4))} className="rounded-lg border border-white/20 px-3 py-2">A+</button></div><button onClick={() => setPlaying((value) => !value)} className="flex items-center gap-2 rounded-full bg-terra px-5 py-3 font-medium">{playing ? <CirclePause size={21} /> : <CirclePlay size={21} />}{playing ? "暂停" : "开始"}</button><div className="flex items-center justify-end gap-2"><button aria-label="减慢滚动" onClick={() => setSpeed((value) => Math.max(10, value - 6))} className="rounded-lg border border-white/20 px-3 py-2">慢</button><button aria-label="加快滚动" onClick={() => setSpeed((value) => Math.min(80, value + 6))} className="rounded-lg border border-white/20 px-3 py-2">快</button></div></div>
      </div>}
    </div>
  );
}
