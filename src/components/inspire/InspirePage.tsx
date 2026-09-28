"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Archive, Check, Clipboard, Compass, Database, ExternalLink, ImagePlus, Loader2, NotebookPen, Search, X } from "lucide-react";
import { useThoughtsStore } from "@/store/thoughts-store";
import { useResourcesStore } from "@/store/resources-store";
import { useHydrated } from "@/hooks/useHydrated";
import { saveInspirationImages } from "@/lib/inspiration-media";
import { RESOURCE_KINDS, type ContentResource, type ResourceKind } from "@/types/resource";
import type { Thought } from "@/types/thought";
import { NoteImages } from "./NoteImages";
import { ExternalDiscovery } from "./ExternalDiscovery";

type View = "notes" | "discover";
interface PendingImage { file: File; preview: string }

function localDateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (localDateKey(today.toISOString()) === key) return "今天";
  if (localDateKey(yesterday.toISOString()) === key) return "昨天";
  return year === today.getFullYear() ? `${month}月${day}日` : `${year}年${month}月${day}日`;
}

function groupByDay(thoughts: Thought[]): [string, Thought[]][] {
  const groups = new Map<string, Thought[]>();
  [...thoughts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach((thought) => {
    const key = localDateKey(thought.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), thought]);
  });
  return Array.from(groups.entries());
}

function NotesTimeline({ thoughts, resources }: { thoughts: Thought[]; resources: ContentResource[] }) {
  const addFromThought = useResourcesStore((state) => state.addFromThought);
  const [kinds, setKinds] = useState<Record<string, ResourceKind>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState("");
  const groups = groupByDay(thoughts);

  async function copyThought(thought: Thought) {
    try {
      await navigator.clipboard.writeText(thought.content);
      setCopyError("");
      setCopiedId(thought.id);
      window.setTimeout(() => setCopiedId((current) => current === thought.id ? null : current), 1800);
    } catch { setCopyError("复制失败，请手动选中随笔文字复制"); }
  }

  if (!groups.length) return <div className="rounded-2xl border border-dashed border-line py-16 text-center"><NotebookPen className="mx-auto text-muted" /><p className="mt-3 text-sm text-muted">第一笔随时可以很短，也可以只有一张图片。</p></div>;

  return (
    <div className="space-y-9">
      {copyError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{copyError}</p>}
      {groups.map(([day, items]) => (
        <section key={day} className="grid gap-4 md:grid-cols-[112px_1fr]">
          <div className="md:pt-1"><p className="text-xl font-semibold text-ink">{dayLabel(day)}</p><p className="mt-1 text-xs text-muted">{day.replaceAll("-", ".")}</p></div>
          <div className="relative space-y-3 border-l border-line pl-5 before:absolute before:-left-[5px] before:top-2 before:h-2.5 before:w-2.5 before:rounded-full before:bg-terra">
            {items.map((thought) => {
              const stored = resources.some((resource) => resource.sourceThoughtId === thought.id);
              const kind = kinds[thought.id] ?? "观点";
              return (
                <article key={thought.id} className="rounded-[18px] border border-line bg-white p-4 shadow-[0_8px_25px_-22px_rgba(23,23,25,.5)] md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><time className="text-xs font-medium text-terra">{new Date(thought.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time><div className="flex gap-1.5">{(Array.isArray(thought.tags) ? thought.tags : []).map((tag) => <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">#{tag}</span>)}</div></div>
                  {thought.content && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink">{thought.content}</p>}
                  <NoteImages imageIds={thought.imageIds} />
                  {thought.sourceUrl && <a href={thought.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-terra"><ExternalLink size={12} />查看原始链接</a>}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                    {thought.content.trim() && <button type="button" onClick={() => copyThought(thought)} aria-label="复制随笔文字" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-medium text-ink-soft hover:border-terra hover:text-terra">{copiedId === thought.id ? <Check size={13} /> : <Clipboard size={13} />}{copiedId === thought.id ? "已复制" : "复制文字"}</button>}
                    <select value={kind} onChange={(event) => setKinds((current) => ({ ...current, [thought.id]: event.target.value as ResourceKind }))} className="min-h-9 rounded-lg border border-line bg-white px-2 text-xs text-ink-soft" aria-label="资源分类">{RESOURCE_KINDS.map((item) => <option key={item}>{item}</option>)}</select>
                    <button disabled={stored} onClick={() => addFromThought(thought, kind)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-terra-wash px-3 text-xs font-semibold text-terra-deep disabled:opacity-55">{stored ? <><Check size={13} />已在资源库</> : <><Archive size={13} />沉淀进资源库</>}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ResourcesPanel() {
  const stored = useResourcesStore((state) => state.resources);
  const resources = Array.isArray(stored) ? stored : [];
  const [kind, setKind] = useState<ResourceKind | "全部">("全部");
  const [query, setQuery] = useState("");
  const visible = resources.filter((item) => (kind === "全部" || item.kind === kind) && (!query.trim() || `${item.title} ${item.body}`.toLowerCase().includes(query.toLowerCase())));

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">长期积累 · 可检索</p><h2 className="mt-1 text-2xl font-semibold">成熟资源库</h2><p className="mt-1 text-sm text-muted">这里不是随笔堆。只有值得反复调用的内容零件才沉淀进来。</p></div><div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索资源" className="min-h-10 rounded-xl border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-terra" /></div></div>
      <div className="mb-5 flex flex-wrap gap-2">{(["全部", ...RESOURCE_KINDS] as const).map((item) => <button key={item} onClick={() => setKind(item)} className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === item ? "border-terra bg-terra text-white" : "border-line bg-white text-ink-soft"}`}>{item} <span className="opacity-60">{item === "全部" ? resources.length : resources.filter((resource) => resource.kind === item).length}</span></button>)}</div>
      {!visible.length ? <div className="rounded-2xl border border-dashed border-line py-16 text-center"><Database className="mx-auto text-muted" /><p className="mt-3 text-sm text-muted">还没有符合条件的成熟资源。</p><p className="mt-1 text-xs text-muted">回到灵感随笔，把值得长期使用的记录“沉淀进资源库”。</p></div> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{visible.map((resource) => <article key={resource.id} className="rounded-2xl border border-line bg-white p-4"><span className="rounded-full bg-terra-wash px-2 py-1 text-[10px] font-semibold text-terra-deep">{resource.kind}</span>{resource.origin === "ai_analysis" && <span className="ml-2 text-[10px] text-muted">AI 提炼 · 待核对</span>}<h3 className="mt-3 text-sm font-semibold leading-6">{resource.title}</h3><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-ink-soft">{resource.body || "图片资源"}</p><NoteImages imageIds={resource.imageIds} /><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted"><span>沉淀于 {new Date(resource.createdAt).toLocaleDateString("zh-CN")}</span>{resource.sourceUrl && <a href={resource.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-terra">核对来源 <ExternalLink size={11} /></a>}</div></article>)}</div>}
    </section>
  );
}

export function InspirePage() {
  const hydrated = useHydrated();
  const addThought = useThoughtsStore((state) => state.addThought);
  const storedThoughts = useThoughtsStore((state) => state.thoughts);
  const storedResources = useResourcesStore((state) => state.resources);
  const thoughts = hydrated && Array.isArray(storedThoughts) ? storedThoughts : [];
  const resources = hydrated && Array.isArray(storedResources) ? storedResources : [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>("notes");
  const [capture, setCapture] = useState("");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addFiles(files: File[]) {
    setError("");
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) { setError("请选择图片文件"); return; }
    setPending((current) => {
      const room = Math.max(0, 4 - current.length);
      if (imageFiles.length > room) setError("每条随笔最多添加 4 张图片");
      return [...current, ...imageFiles.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }))];
    });
  }

  function removePending(index: number) {
    setPending((current) => current.filter((item, itemIndex) => { if (itemIndex === index) URL.revokeObjectURL(item.preview); return itemIndex !== index; }));
  }

  async function saveNote() {
    if (!capture.trim() && !pending.length) return;
    setSaving(true); setError("");
    try {
      const imageIds = await saveInspirationImages(pending.map((item) => item.file));
      const sourceUrl = capture.match(/https?:\/\/[^\s]+/i)?.[0];
      addThought(capture, ["灵感随笔"], { imageIds, sourceUrl });
      pending.forEach((item) => URL.revokeObjectURL(item.preview));
      setCapture(""); setPending([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试"); }
    finally { setSaving(false); }
  }

  const tabs = [
    { key: "notes" as const, label: "灵感随笔", sub: hydrated ? `${thoughts.length} 笔` : "—", icon: NotebookPen },
    { key: "discover" as const, label: "外部发现", sub: "子功能", icon: Compass },
  ];

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-6 sm:px-6 md:px-10 md:pt-9">
      <header className="mb-6"><p className="text-xs font-semibold tracking-[2px] text-terra">我的随笔 · 按天记录</p><h1 className="mt-1 text-[32px] font-semibold tracking-[-.7px]">灵感</h1><p className="mt-2 text-sm text-muted">这里留住刚冒出的想法。原始资料与长期积累，放在独立的资源库。</p><div className="mt-3 flex flex-wrap gap-3"><Link href="/assistant" className="inline-flex min-h-10 items-center rounded-xl bg-terra px-3 text-xs font-semibold text-white">交给本机 Codex 讨论 →</Link><Link href="/resources" className="inline-flex min-h-10 items-center rounded-xl border border-terra/25 px-3 text-xs font-semibold text-terra-deep">打开资源库 →</Link></div></header>

      <nav className="mb-7 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-sm" aria-label="灵感库功能">
        {tabs.map(({ key, label, sub, icon: Icon }) => <button key={key} onClick={() => setView(key)} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-left transition ${view === key ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:bg-surface-2"}`}><Icon size={17} /><span><b className="block text-xs sm:text-sm">{label}</b><small className={`hidden text-[10px] sm:block ${view === key ? "text-white/65" : "text-muted"}`}>{sub}</small></span></button>)}
      </nav>

      {view === "notes" && <>
        <section className="mb-8 overflow-hidden rounded-[22px] border border-line bg-white shadow-card">
          <div className="grid md:grid-cols-[190px_1fr]">
            <div className="bg-[#143f34] p-5 text-white"><NotebookPen size={20} /><h2 className="mt-6 text-xl font-semibold">随手记一笔</h2><p className="mt-2 text-xs leading-5 text-white/65">文字、图片、链接都可以。先忠实记录，不急着分类。</p></div>
            <div className="p-4 md:p-5">
              <textarea value={capture} onChange={(event) => setCapture(event.target.value)} onPaste={(event) => { const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/")); if (images.length) addFiles(images); }} placeholder="此刻在想什么？也可以直接粘贴截图或链接……" className="min-h-[126px] w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 text-sm leading-7 outline-none focus:border-terra focus:bg-white" />
              {pending.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{pending.map((item, index) => <div key={item.preview} className="group relative aspect-square overflow-hidden rounded-xl border border-line">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.preview} alt="待保存图片" className="h-full w-full object-cover" /><button onClick={() => removePending(index)} aria-label="移除图片" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X size={14} /></button></div>)}</div>}
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink-soft"><ImagePlus size={15} />添加图片 <span className="text-muted">{pending.length}/4</span></button><button onClick={saveNote} disabled={saving || (!capture.trim() && !pending.length)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-5 text-sm font-semibold text-white disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : <NotebookPen size={16} />}{saving ? "保存中…" : "记下这一笔"}</button></div>
              {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
            </div>
          </div>
        </section>
        <div className="mb-5 flex items-end justify-between"><div><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">时间流</p><h2 className="mt-1 text-2xl font-semibold">最近写下的</h2></div><span className="text-xs text-muted">按天自动整理</span></div>
        <NotesTimeline thoughts={thoughts} resources={resources} />
      </>}
      {view === "discover" && <ExternalDiscovery />}
    </div>
  );
}
