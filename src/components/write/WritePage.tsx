"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, BookOpen, Check, Clipboard, ExternalLink, Loader2, Plus, ShieldCheck } from "lucide-react";
import { SourceLibrary } from "./SourceLibrary";
import { useHydrated } from "@/hooks/useHydrated";
import { listSources, saveSource } from "@/lib/sources/local-db";
import { evidenceCandidates, sourceParagraphs as paragraphs } from "@/lib/sources/evidence";
import { canonicalSourceUrl, parseSourceUrl, platformOf } from "@/lib/sources/platform";
import { uid } from "@/lib/utils";
import { useResourcesStore } from "@/store/resources-store";
import { useWritingDraftsStore } from "@/store/writing-drafts-store";
import type { SourceCoverage, SourceDocument, SourceExtraction } from "@/types/source";

const COVERAGE_LABELS: Record<SourceCoverage, string> = { full: "已取正文", excerpt: "部分原文", preview: "仅简介" };

export function WritePage() {
  const hydrated = useHydrated();
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"sources" | "draft">("sources");
  const [libraryVersion, setLibraryVersion] = useState(0);
  const sourcePane = useRef<HTMLDivElement>(null);
  const captureForm = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [coverage, setCoverage] = useState<SourceCoverage>("excerpt");
  const [captureMethod, setCaptureMethod] = useState<SourceDocument["captureMethod"]>("pasted_text");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedEvidenceId, setCopiedEvidenceId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const drafts = useWritingDraftsStore((state) => state.drafts);
  const activeId = useWritingDraftsStore((state) => state.activeId);
  const createDraft = useWritingDraftsStore((state) => state.createDraft);
  const selectDraft = useWritingDraftsStore((state) => state.selectDraft);
  const updateDraft = useWritingDraftsStore((state) => state.updateDraft);
  const addEvidence = useWritingDraftsStore((state) => state.addEvidence);
  const removeEvidence = useWritingDraftsStore((state) => state.removeEvidence);
  const addFromSource = useResourcesStore((state) => state.addFromSource);
  const draft = hydrated ? drafts.find((item) => item.id === activeId) ?? drafts[0] : undefined;
  const selected = sources.find((item) => item.id === selectedSourceId) ?? null;

  useEffect(() => {
    listSources().then((items) => { setSources(items); setSelectedSourceId(new URLSearchParams(window.location.search).get("source")); })
      .catch(() => setError("本机素材库暂时无法打开；请检查浏览器是否允许站点存储"));
  }, []);

  async function readLink() {
    const parsed = parseSourceUrl(link || sourceText);
    if (!parsed) { setError("请先粘贴有效的 HTTPS 链接"); return; }
    setFetching(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/sources/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: parsed.toString() }) });
      const result = await response.json() as SourceExtraction & { error?: string };
      if (!response.ok) throw new Error(result.error || "读取失败");
      const pastedShareText = Boolean(sourceText.trim() && sourceText.trim() !== parsed.toString());
      setLink(result.url); setTitle(result.title);
      if (pastedShareText) {
        setSourceText(sourceText); setCoverage("excerpt"); setCaptureMethod("pasted_text");
        setMessage("已识别来源并保留你粘贴的分享文字；它仍不等于完整原文。" + result.note);
      } else {
        setSourceText(result.body); setCoverage(result.coverage); setCaptureMethod("public_page"); setMessage(result.note);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取失败，请粘贴原文");
    } finally { setFetching(false); }
  }

  async function saveCapture() {
    const parsed = parseSourceUrl(link || sourceText);
    const body = !link && parsed && sourceText.trim() === parsed.toString() ? "" : sourceText.trim();
    if (!body && !parsed) { setError("请粘贴原文，或至少提供一个来源链接"); return; }
    if (body.length > 30_000) { setError("单份素材最多保存 3 万字，请拆成两份后分别保存"); return; }
    setSaving(true); setError("");
    const url = parsed ? canonicalSourceUrl(parsed) : undefined;
    const existing = (editingId ? sources.find((item) => item.id === editingId) : undefined) ?? (url ? sources.find((item) => item.url === url) : undefined);
    const now = new Date().toISOString();
    const keepOld = Boolean(existing?.body && (!body || (coverage === "preview" && existing.coverage !== "preview")));
    const item: SourceDocument = {
      ...existing,
      id: existing?.id ?? uid(), platform: parsed ? platformOf(parsed) : "article", url,
      title: title.trim().slice(0, 200) || body.split(/\n/)[0]?.slice(0, 60) || "待补原文的素材",
      body: keepOld ? existing!.body : body, coverage: keepOld ? existing!.coverage : body ? coverage : "preview",
      captureMethod: keepOld ? existing!.captureMethod : !body ? "link_only" : captureMethod,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
      // Edited text must not keep an AI analysis or timed transcript of the old text.
      ...(!keepOld && existing && existing.body !== body ? { analysis: undefined, transcript: undefined, status: undefined, error: undefined } : {}),
    };
    try {
      await saveSource(item);
      setSources(await listSources()); setSelectedSourceId(item.id); setShowAll(false);
      setLibraryVersion(value => value + 1);
      setLink(""); setTitle(""); setSourceText(""); setCoverage("excerpt"); setCaptureMethod("pasted_text"); setEditingId(null);
      setMessage(existing ? "同一链接已更新，没有重复入库。" : "已存入素材库。你可以摘录论据，再在右侧写原创观点。");
    } catch { setError("保存失败。素材仍在输入框中，请检查浏览器存储空间后重试"); }
    finally { setSaving(false); }
  }

  function cite(quote: string) {
    if (!selected || !quote.trim()) return;
    const id = draft?.id ?? createDraft();
    addEvidence(id, selected.id, quote.trim());
    setMobileTab("draft");
  }

  function editSelected() {
    if (!selected) return;
    setEditingId(selected.id); setLink(selected.url ?? ""); setTitle(selected.title);
    setSourceText(selected.body); setCoverage(selected.coverage); setCaptureMethod("pasted_text");
    setSelectedSourceId(null);
    setMessage("已带入左侧添加素材区；补全原文后保存会更新原记录。");
    window.requestAnimationFrame(() => {
      const details = captureForm.current?.closest("details");
      if (details) details.open = true;
      captureForm.current?.scrollIntoView({ block: "nearest" });
    });
  }

  async function copyDraft() {
    if (!draft?.body.trim()) return;
    try { await navigator.clipboard.writeText(draft.body); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError("复制失败，请手动选中草稿正文复制"); }
  }

  async function copyEvidence(id: string, quote: string) {
    try {
      await navigator.clipboard.writeText(quote);
      setCopiedEvidenceId(id);
      window.setTimeout(() => setCopiedEvidenceId((current) => current === id ? null : current), 1800);
    } catch { setError("引用复制失败，请手动选中原句复制"); }
  }

  const sourceParagraphs = selected ? paragraphs(selected.body) : [];
  const displayedParagraphs = showAll ? sourceParagraphs : sourceParagraphs.slice(0, 8);
  const candidates = selected?.coverage === "preview" ? [] : evidenceCandidates(sourceParagraphs);

  return (
    <div className="mx-auto max-w-[1450px] px-4 pb-24 pt-6 sm:px-6 md:px-9 md:pt-9">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-[2px] text-terra">素材 → 论据 → 原创</p><h1 className="mt-1 text-[32px] font-semibold tracking-[-.7px]">边查边写</h1><p className="mt-2 text-sm text-muted">来源原文和你的判断分开放；写作时并排看，手机上轻点切换。</p></div>
        <Link href="/inspire" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink-soft">灵感随笔与成熟资源库 →</Link>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-line bg-white p-1 lg:hidden">
        <button onClick={() => setMobileTab("sources")} className={`min-h-10 rounded-lg text-sm font-semibold ${mobileTab === "sources" ? "bg-terra text-white" : "text-muted"}`}>素材与论据</button>
        <button onClick={() => setMobileTab("draft")} className={`min-h-10 rounded-lg text-sm font-semibold ${mobileTab === "draft" ? "bg-terra text-white" : "text-muted"}`}>写推特草稿</button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div ref={sourcePane} className={`${mobileTab === "sources" ? "block" : "hidden"} min-w-0 space-y-4 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-100px)] lg:overflow-y-auto lg:overscroll-contain`}>
          <div className={selected ? "hidden" : "block"}>
          <SourceLibrary key={libraryVersion} workspace onSourcesChange={setSources} onPick={source => { setSelectedSourceId(source.id); setShowAll(false); sourcePane.current?.scrollTo(0, 0); }} captureForm={
          <div ref={captureForm} className="mt-4 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">手动粘贴原文 / 补充字幕</h3>
            <div className="mt-4 flex gap-2"><input type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="粘贴来源链接（可选）" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm outline-none focus:border-terra" /><button onClick={readLink} disabled={fetching || !parseSourceUrl(link || sourceText)} aria-label={fetching ? "正在读取链接" : "尝试读取链接"} className="min-h-11 flex-none rounded-xl border border-line bg-bg px-3 text-xs font-semibold text-ink-soft disabled:opacity-40">{fetching ? <Loader2 size={16} className="animate-spin" /> : "尝试读取"}</button></div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题（可稍后补）" className="mt-2 min-h-11 w-full rounded-xl border border-line px-3 text-sm outline-none focus:border-terra" />
            <textarea value={sourceText} onChange={(event) => { setSourceText(event.target.value); setCaptureMethod("pasted_text"); if (event.target.value && coverage === "preview") setCoverage("excerpt"); }} placeholder="粘贴文章正文、推特长帖、小红书笔记、视频字幕或分享文字。只有链接读不到时，这里就是稳定的补充入口。" className="mt-2 min-h-[150px] w-full resize-y rounded-xl border border-line bg-bg px-3 py-3 text-sm leading-6 outline-none focus:border-terra" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><label className="text-xs text-muted">文字完整度 <select value={coverage} onChange={(event) => setCoverage(event.target.value as SourceCoverage)} className="ml-1 min-h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink"><option value="excerpt">片段 / 字幕节选</option><option value="full">完整原文 / 完整字幕</option><option value="preview">仅标题或简介</option></select></label><button onClick={saveCapture} disabled={saving || (!link.trim() && !sourceText.trim())} className="min-h-11 rounded-xl bg-terra px-5 text-sm font-semibold text-white disabled:opacity-40">{saving ? "保存中…" : editingId ? "更新这份素材" : "存入素材库"}</button></div>
          </div>} />
          </div>

          {selected && <section className="rounded-[22px] border border-line bg-white p-4 shadow-card sm:p-5">
            <button onClick={() => { setSelectedSourceId(null); sourcePane.current?.scrollTo(0, 0); }} className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-terra"><ArrowLeft size={16} />返回搜索与分类</button>
            {selected.transcript && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">这是机器识别的口播文字，可能有同音字和断句错误。引用人名、数字、案例之前，请回到原视频核对。</p>}
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-semibold text-terra">原始出处 · {COVERAGE_LABELS[selected.coverage]}</p><h2 className="mt-1 text-lg font-semibold leading-7">{selected.title}</h2></div><div className="flex gap-3"><button onClick={editSelected} className="text-xs font-medium text-terra">补全原文</button>{selected.url && <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-terra">打开来源 <ExternalLink size={13} /></a>}</div></div>
            {selected.coverage === "preview" && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">只有简介；不能把它当作视频口播或文章全文。请补充原文再挑选论据。</p>}
            {selected.book && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">《{selected.book.title}》第 {selected.book.chapterNumber} 节第 {selected.book.itemNumber} 条 · 作者评级 {selected.book.grade}。这是书中的主张与引文，不等于工作站已核实；使用数字前请核对下方原书所列文献。</p>}
            {selected.book && selected.book.references.length > 0 && <details className="mt-3 rounded-xl border border-line p-3 text-xs leading-5"><summary className="cursor-pointer font-semibold">原书所列文献 · {selected.book.references.length}</summary>{selected.book.references.map((ref, index) => <p key={index} className="mt-2 break-words text-muted">{ref.text}{ref.urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-2 text-terra underline">查看原文 ↗</a>)}</p>)}</details>}
            {selected.analysis && <div className="mt-4 rounded-xl bg-terra-wash p-4"><h3 className="text-xs font-semibold text-terra">AI 归纳 · 不等于来源原话</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{selected.analysis.summary}</p><ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5">{selected.analysis.keyPoints.map((point, index) => <li key={index}>{point}</li>)}</ul></div>}
            {candidates.length > 0 && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-900">可能有用的论据 / 案例（待核对）</p><p className="mt-1 text-[11px] text-emerald-800">只挑出来源中的原句，没有替你验证数字真假。</p><div className="mt-3 space-y-2">{candidates.map((quote, index) => <div key={`${selected.id}-candidate-${index}`} className="flex items-start gap-2"><p className="min-w-0 flex-1 line-clamp-2 text-xs leading-5 text-ink-soft">{quote}</p><button onClick={() => cite(quote)} className="flex-none rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-terra">摘录</button></div>)}</div></div>}
            <div className="mt-4 space-y-2">{displayedParagraphs.map((part, index) => <div key={`${selected.id}-${index}`} className="rounded-xl border border-line bg-bg p-3"><p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">{part}</p>{selected.coverage !== "preview" && <div className="mt-2 flex flex-wrap justify-end gap-2"><button onClick={() => addFromSource(selected, part, /\d/.test(part) ? "佐证" : "案例")} className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-white"><Archive size={13} />沉淀成资源</button><button onClick={() => cite(part)} className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-white px-2 text-xs font-semibold text-terra"><BookOpen size={13} />摘录到草稿</button></div>}</div>)}</div>
            {sourceParagraphs.length > 8 && <button onClick={() => setShowAll(!showAll)} className="mt-3 text-xs font-medium text-terra">{showAll ? "收起" : `展开其余 ${sourceParagraphs.length - 8} 段`}</button>}
          </section>}
        </div>

        <div className={`${mobileTab === "draft" ? "block" : "hidden"} min-w-0 lg:block`}>
          <section className="sticky top-4 rounded-[22px] border border-line bg-white p-4 shadow-card sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">原创写作</p><h2 className="mt-1 text-xl font-semibold">推特草稿</h2></div><button onClick={() => createDraft()} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold"><Plus size={14} />新建</button></div>
            <p className="mt-2 text-xs leading-5 text-muted">先写你的判断；下方摘录仅作核对，不会自动拼进正文。</p>
            {hydrated && drafts.length > 1 && <select value={draft?.id ?? ""} onChange={(event) => selectDraft(event.target.value)} aria-label="切换草稿" className="mt-3 min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm">{drafts.map((item) => <option key={item.id} value={item.id}>{item.title || item.body.slice(0, 25) || "未命名草稿"}</option>)}</select>}
              <input disabled={!hydrated} value={draft?.title ?? ""} onChange={(event) => updateDraft(draft?.id ?? createDraft(), { title: event.target.value, body: draft?.body ?? "" })} placeholder="给这篇草稿起个工作标题" className="mt-4 min-h-11 w-full rounded-xl border border-line px-3 text-sm font-semibold outline-none focus:border-terra" />
              <textarea aria-label="草稿正文" disabled={!hydrated} value={draft?.body ?? ""} onChange={(event) => updateDraft(draft?.id ?? createDraft(), { title: draft?.title ?? "", body: event.target.value })} placeholder={"我的观点是什么？证据支持到哪里？适用边界是什么？\n\n在这里写，不必切去 X。"} className="mt-3 min-h-[420px] w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-[15px] leading-7 outline-none focus:border-terra" />
            {draft && <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">自动保存在当前浏览器 · 约 {Array.from(draft.body).length} 字</p><button onClick={copyDraft} disabled={!draft.body.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-terra px-4 text-xs font-semibold text-white disabled:opacity-40">{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "已复制" : "复制正文"}</button></div>
              <div className="mt-5 border-t border-line pt-4"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-terra" /><h3 className="text-sm font-semibold">引用备忘 <span className="font-normal text-muted">{draft.evidence.length}</span></h3></div><p className="mt-1 text-xs text-muted">这些是来源原话，不等于已核实的事实；发布前请回看原链接。</p>
                {!draft.evidence.length ? <p className="mt-3 rounded-xl bg-bg p-3 text-xs text-muted">在左侧素材里点“摘录到草稿”，这里会留下原句和出处。</p> : <div className="mt-3 max-h-[310px] space-y-2 overflow-y-auto">{draft.evidence.map((item) => { const source = sources.find((entry) => entry.id === item.sourceId); return <div key={item.id} className="rounded-xl border border-line bg-bg p-3"><p className="line-clamp-3 text-xs leading-5 text-ink-soft">“{item.quote}”</p><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] text-muted">{source?.title ?? "来源已不在本机"}</span><div className="flex flex-none items-center gap-2">{source?.url && <a href={source.url} target="_blank" rel="noreferrer" className="text-[11px] text-terra">查原文 ↗</a>}<button type="button" onClick={() => copyEvidence(item.id, item.quote)} aria-label="复制引用原句" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-terra hover:bg-white">{copiedEvidenceId === item.id ? <Check size={12} /> : <Clipboard size={12} />}{copiedEvidenceId === item.id ? "已复制" : "复制"}</button><button onClick={() => removeEvidence(draft.id, item.id)} className="text-[11px] text-muted">移除</button></div></div></div>; })}</div>}
              </div>
            </>}
          </section>
        </div>
      </div>
      <p className="mt-5 text-xs leading-5 text-muted">当前开发版的来源与草稿保存在本机浏览器，手机和电脑尚未自动同步；请勿把它当作唯一备份。X / 小红书 / 抖音等链接若只读到简介，会明确提示补全文字。</p>
    </div>
  );
}
