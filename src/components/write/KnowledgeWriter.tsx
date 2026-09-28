'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { assistantRequest } from '@/components/assistant/client';
import { SourceLibrary } from './SourceLibrary';
import { InspirationPicker } from './InspirationPicker';
import { WebSearchPanel } from './WebSearchPanel';
import { listSources } from '@/lib/sources/local-db';
import { useHydrated } from '@/hooks/useHydrated';
import { useThoughtsStore } from '@/store/thoughts-store';
import type { Thought } from '@/types/thought';
import type { KnowledgeDraft, WritingCandidate, EvidenceAnalysis, WritingState } from '@/types/writing';
import type { WritingDraft } from '@/types/source';

const request = (body?: unknown) => assistantRequest('/writing', body);
const field = 'w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-terra';
const button = 'min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium disabled:opacity-40';
const primary = 'min-h-10 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white disabled:opacity-40';
const selectedDraftKey = 'zmt-writing-selected-draft';
function cleanBody(draft: KnowledgeDraft) {
  return draft.references.reduce((text, ref) => ref.marker ? text.split(ref.marker).join('') : text, draft.body);
}

export function KnowledgeWriter() {
  const thoughtsHydrated = useHydrated();
  const storedThoughts = useThoughtsStore((state) => state.thoughts);
  const thoughts = thoughtsHydrated && Array.isArray(storedThoughts) ? storedThoughts : [];
  const [drafts, setDrafts] = useState<KnowledgeDraft[]>([]);
  const [draft, setDraft] = useState<KnowledgeDraft | null>(null);
  const current = useRef<KnowledgeDraft | null>(null);
  const saved = useRef('');
  const saving = useRef<Promise<void> | null>(null);
  const locked = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('正在连接本机知识库…');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const ai = useRef<AbortController | null>(null);
  const [mobile, setMobile] = useState('write');
  const [pickerOpenToken, setPickerOpenToken] = useState(0);
  const [leftTab, setLeftTab] = useState('知识推荐');
  const [linkedSourceId, setLinkedSourceId] = useState<string>();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState('');
  const cursor = useRef(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [candidates, setCandidates] = useState<WritingCandidate[]>([]);
  const [analysis, setAnalysis] = useState<EvidenceAnalysis | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [preview, setPreview] = useState<{ blockId: string; text: string; caution: string; draftId: string; body: string } | null>(null);
  const [original, setOriginal] = useState<{ id: string; text: string } | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [recovery, setRecovery] = useState<KnowledgeDraft[]>([]);
  const [publication, setPublication] = useState('');
  const context = (query || selection || `${draft?.title || ''}\n${draft?.body.slice(-5000) || ''}`).replace(/〔引\d+〕/g, '').slice(0, 12000);
  const contextRef = useRef(context); contextRef.current = context;
  const signature = (value: KnowledgeDraft) => JSON.stringify([value.id, value.title, value.body]);
  function remember(value: KnowledgeDraft) {
    try {
      const copies = JSON.parse(localStorage.getItem('zmt-writing-recovery') || '{}'); copies[value.id] = value;
      localStorage.setItem('zmt-writing-recovery', JSON.stringify(copies));
    } catch { setError('浏览器无法保存临时恢复副本。请等待本机保存成功后再离开，或导出当前草稿。'); }
  }
  function forget(value: KnowledgeDraft) {
    try {
      const copies = JSON.parse(localStorage.getItem('zmt-writing-recovery') || '{}');
      if (copies[value.id] && signature(copies[value.id]) === signature(value)) { delete copies[value.id]; localStorage.setItem('zmt-writing-recovery', JSON.stringify(copies)); }
    } catch { /* Server copy is already durable; never clear unrecognized recovery data. */ }
  }

  function choose(value: KnowledgeDraft | null) {
    ai.current?.abort(); setAiBusy(false); setPreview(null); setAnalysis(null); setSelection(''); cursor.current = value?.body.length || 0;
    current.current = value; saved.current = value ? signature(value) : ''; setDraft(value); setPublication('');
    try { sessionStorage.setItem(selectedDraftKey, value?.id || ''); } catch { /* Selection still works for this page. */ }
    const url = new URL(window.location.href);
    if (url.searchParams.has('draft')) {
      if (value) url.searchParams.set('draft', value.id); else url.searchParams.delete('draft');
      window.history.replaceState(window.history.state, '', url);
    }
  }
  function accept(value: KnowledgeDraft) {
    current.current = value; saved.current = signature(value); setDraft(value);
    setDrafts(items => [value, ...items.filter(item => item.id !== value.id)]);
    setStatus('已保存到本机知识库');
  }
  async function flush(): Promise<void> {
    if (saving.current) await saving.current;
    const snapshot = current.current;
    if (!snapshot || signature(snapshot) === saved.current) return;
    setStatus('正在保存…');
    const operation = (async () => {
      const value: KnowledgeDraft = await request({ action: 'save', id: snapshot.id, revision: snapshot.revision, title: snapshot.title, body: snapshot.body });
      saved.current = signature(value);
      forget(value);
      setDrafts(items => [value, ...items.filter(item => item.id !== value.id)]);
      if (current.current?.id === value.id) {
        const next = { ...value, title: current.current.title, body: current.current.body };
        current.current = next; setDraft(next);
        setStatus(signature(next) === saved.current ? '已保存到本机知识库' : '仍有文字等待保存…');
      }
    })();
    saving.current = operation;
    try { await operation; } finally { if (saving.current === operation) saving.current = null; }
    if (current.current && signature(current.current) !== saved.current) await flush();
  }
  function fail(cause: unknown) { setError(cause instanceof Error ? cause.message : '操作失败'); setStatus('未保存成功；当前文字仍保留，请导出备份后重试'); }

  useEffect(() => {
    let cancelled = false;
    const sourceId = new URLSearchParams(window.location.search).get('source');
    if (sourceId && /^[a-f0-9]{24}$/.test(sourceId)) { setLinkedSourceId(sourceId); setLeftTab('原始素材'); }
    request().then((state: WritingState) => {
      if (cancelled) return;
      setDrafts(state.drafts);
      const id = new URLSearchParams(window.location.search).get('draft');
      let remembered: string | null = null;
      try { remembered = sessionStorage.getItem(selectedDraftKey); } catch { /* Fall back to the latest draft. */ }
      choose(id ? state.drafts.find(item => item.id === id) || null : remembered === '' ? null : state.drafts.find(item => item.id === remembered) || state.drafts[0] || null);
      setReady(true); setStatus('本机知识库已连接');
      try { const copies = Object.values(JSON.parse(localStorage.getItem('zmt-writing-recovery') || '{}')) as KnowledgeDraft[]; setRecovery(copies.filter(copy => typeof copy.body === 'string' && !state.drafts.some(item => signature(item) === signature(copy)))); } catch { setError('临时恢复记录无法读取，未修改原数据。'); }
      try { const legacy = JSON.parse(localStorage.getItem('zmt-writing-drafts') || '{}'); setLegacyCount(legacy.state?.drafts?.length || 0); } catch { setError('旧草稿索引无法读取，未修改原数据。'); }
    }).catch(fail);
    return () => { cancelled = true; ai.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready || !draft || locked.current || signature(draft) === saved.current) return;
    const timer = setTimeout(() => { void flush().catch(fail); }, 1000);
    return () => clearTimeout(timer);
  }, [draft?.id, draft?.title, draft?.body, ready]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (current.current && signature(current.current) !== saved.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, []);
  useEffect(() => { if (preview) document.querySelector('[aria-label="AI 改写预览"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [!!preview]);
  useEffect(() => {
    ai.current?.abort(); setAiBusy(false); setAnalysis(null); setPreview(null);
    setCandidates([]); setSearchError('');
    if (!ready || context.trim().length < 2) { setSearching(false); return; }
    let cancelled = false; setSearching(true);
    const timer = setTimeout(() => {
      request({ action: 'search', query: context }).then(data => { if (!cancelled) setCandidates(data.candidates); }).catch(cause => { if (!cancelled) setSearchError(cause.message); }).finally(() => { if (!cancelled) setSearching(false); });
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [context, ready, draft?.id]);

  async function exclusive(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await flush(); await work(); } catch (cause) { fail(cause); }
    finally { locked.current = false; setBusy(false); }
  }
  async function reconnect() {
    await exclusive(async () => {
      const data: WritingState = await request();
      setDrafts(data.drafts);
      if (!current.current && !ready) choose(data.drafts[0] || null);
      setReady(true);
      setStatus('已重新连接；当前草稿已保存');
    });
  }
  useEffect(() => {
    if (!error.includes('本机工作站暂时断开')) return;
    const timer = window.setTimeout(() => { if (!locked.current) void reconnect(); }, 5000);
    return () => window.clearTimeout(timer);
  }, [error]);
  function pickThought(thought: Thought) {
    const alreadyLinked = drafts.some((item) => item.sourceThoughtId === thought.id);
    void exclusive(async () => {
      const value: KnowledgeDraft = await request({ action: 'createFromThought', thought: { id: thought.id, content: thought.content } });
      choose(value); accept(value); setMobile('write');
      setStatus(alreadyLinked ? '已打开这条灵感对应的草稿' : '已从灵感随笔创建草稿；原随笔保留');
    });
  }
  function edit(patch: Partial<Pick<KnowledgeDraft, 'title' | 'body'>>) {
    if (!current.current || locked.current) return;
    const value = { ...current.current, ...patch }; current.current = value; remember(value); setDraft(value); setStatus('等待保存…');
    setPreview(null);
  }
  async function mutate(action: string, extra: Record<string, unknown> = {}) {
    await exclusive(async () => {
      if (!current.current) { const value = await request({ action: 'create' }); accept(value); }
      const value = current.current!;
      const result: KnowledgeDraft = await request({ action, id: value.id, revision: value.revision, ...extra });
      accept(result);
      if (typeof extra.blockId === 'string') {
        try {
          const usage = await assistantRequest(`/writing?usage=${encodeURIComponent(extra.blockId)}`) as { active: boolean }[];
          setCandidates(items => items.map(item => item.block.id === extra.blockId ? { ...item, usedDrafts: usage.filter(entry => entry.active).length } : item));
        } catch { setError('正文已经保存，但使用次数暂未刷新；请稍后查看资源库。'); }
      }
      if (action === 'insert') { setPreview(null); setMobile('write'); cursor.current = Math.min(Number(extra.position) + result.body.length - value.body.length, result.body.length); }
    });
  }
  async function importLegacy() {
    await exclusive(async () => {
      const raw = localStorage.getItem('zmt-writing-drafts'); if (!raw) return;
      // Keep the exact original backup before migration. Storage failure stops import, not deletes data.
      if (!localStorage.getItem('zmt-writing-drafts-before-knowledge')) localStorage.setItem('zmt-writing-drafts-before-knowledge', raw);
      const old = JSON.parse(raw).state?.drafts as WritingDraft[];
      if (!Array.isArray(old)) throw new Error('旧草稿格式无法识别，原数据未改动');
      const sources = await listSources();
      for (const item of old) {
        await request({ action: 'import', draft: { ...item, evidence: item.evidence.map(ref => { const source = sources.find(source => source.id === ref.sourceId); return { ...ref, sourceTitle: source?.title || '旧稿来源（待补）', sourceUrl: source?.url || '' }; }) } });
      }
      const data: WritingState = await request(); setDrafts(data.drafts);
      if (!current.current) choose(data.drafts[0] || null);
      setStatus('旧草稿已导入；原浏览器数据和备份均保留，重复导入不会覆盖新稿');
    });
  }
  async function askAI(action: 'analyze' | 'rewrite', blockId?: string) {
    if (aiBusy) return;
    const controller = new AbortController(); ai.current = controller; setAiBusy(true); setError('');
    const asked = context; const active = current.current;
    try {
      const response = await fetch('/api/assistant/writing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, query: asked, blockId }), signal: controller.signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'AI 分析失败');
      if (controller.signal.aborted || contextRef.current !== asked || current.current?.id !== active?.id) return;
      if (action === 'analyze') { setAnalysis(data); setCandidates(data.candidates); }
      else if (active) { setPreview({ blockId: blockId!, text: data.text, caution: data.caution, draftId: active.id, body: active.body }); setMobile('write'); }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'AI 分析失败，可重试；未改动正文'); }
    finally { if (ai.current === controller) setAiBusy(false); }
  }
  async function viewOriginal(candidate: WritingCandidate) {
    if (original?.id === candidate.block.id) { setOriginal(null); return; }
    try {
      const source = await assistantRequest(`?source=${encodeURIComponent(candidate.block.sourceId)}`);
      const chunk = source.chunks.find((item: { id: string }) => item.id === candidate.block.chunkId);
      setOriginal({ id: candidate.block.id, text: chunk?.text || '原文段落不存在，请核对来源' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : '原文读取失败'); }
  }
  function exportDraft() {
    if (!current.current) return;
    const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `写作备份-${current.current.id}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy(withSources = false) {
    if (!current.current) return;
    const value = current.current;
    // Body can be copied while offline; this is not recorded as publication.
    const sources = value.references.filter(ref => ref.mode !== 'memo' && ref.marker && value.body.includes(ref.marker)).map(ref => `${ref.marker} ${ref.sourceTitle} · ${ref.locator}${ref.sourceUrl ? `\n${ref.sourceUrl}` : ''}（来源说法，待核验）`).join('\n');
    try { await navigator.clipboard.writeText(withSources ? `${value.body}\n\n${sources}` : cleanBody(value)); setStatus(withSources ? '已复制正文与出处；不代表已发布' : '已复制纯正文（不含引用标记）；不代表已发布'); }
    catch { setError('复制失败，请选中正文手动复制或导出备份'); }
  }
  const groups = analysis ? ['支持论据', '相关案例', '反例与限制', '背景材料'] : ['关键词候选 · 尚未判断支持或反对'];
  return <div className="mx-auto max-w-[1500px] px-4 py-7 lg:px-8">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold tracking-widest text-terra">让知识参与每一次写作</p><h1 className="mt-2 text-3xl font-semibold">边查边写</h1><p className="mt-2 text-sm text-muted">左边找论据与反例，右边写自己的判断。AI 推荐，由你确认插入。</p></div><div className="flex gap-3 text-sm text-terra"><Link href="/resources">资源库 ↗</Link><Link href="/assistant">AI 工作台 ↗</Link></div></header>
    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<div className="mt-2 flex gap-3"><button onClick={exportDraft} disabled={!draft} className={button}>导出当前草稿</button><button disabled={busy} onClick={() => void reconnect()} className={button}>重试连接 / 保存</button></div></div>}
    {!!legacyCount && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-3 text-xs text-ink-soft"><span>发现当前浏览器有 {legacyCount} 篇旧草稿。导入会保留原数据，不覆盖本机新稿。</span><button disabled={!ready || busy} onClick={importLegacy} className={button}>备份并导入旧草稿</button></div>}
    {recovery.map(copy => <div key={copy.id} className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>有一份未保存的恢复副本：{copy.title || '未命名草稿'}（{copy.body.length} 字）。恢复为独立副本，不覆盖现有稿。</p><button disabled={busy} onClick={() => exclusive(async () => { const value: KnowledgeDraft = await request({ action: 'recover', draft: copy }); choose(value); accept(value); forget(copy); setRecovery(items => items.filter(item => item.id !== copy.id)); })} className={`${button} mt-2`}>恢复为新稿</button></div>)}
    <div className="mb-4 grid grid-cols-2 gap-2 lg:hidden">{[['sources','找素材'],['write','写正文']].map(([id,label]) => <button key={id} onClick={() => setMobile(id)} className={mobile === id ? primary : button}>{label}</button>)}</div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <aside className={`${mobile === 'sources' ? '' : 'hidden'} min-w-0 space-y-4 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-70px)] lg:overflow-y-auto`}>
        <nav className="flex flex-wrap gap-2" aria-label="素材模式">{['知识推荐','原始素材','AI 快搜'].map(tab => <button key={tab} onClick={() => setLeftTab(tab)} className={leftTab === tab ? primary : button}>{tab}</button>)}</nav>
        {leftTab === '原始素材' && <><p className="text-xs text-muted">原始资料仍可查看与采集；提炼并确认入库后，才进入知识推荐。</p><SourceLibrary initialSourceId={linkedSourceId} /></>}
        {leftTab === '知识推荐' && <>
          <section className="rounded-2xl border border-line bg-white p-4"><label className="text-sm font-semibold" htmlFor="evidence-query">这段话需要什么材料？</label><textarea id="evidence-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={12000} placeholder="留空时自动根据标题和正文检索；也可输入：持续输出的案例，以及它不适用的情况" className={`${field} mt-3 min-h-24`} /><p className="mt-2 text-xs text-muted">{selection && !query ? '正在针对右侧选中的段落查找。' : '自动关键词检索不调用 AI；只有点击分析或改写才使用 Codex 额度。'}</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={!ready || !context.trim() || aiBusy || searching} onClick={() => askAI('analyze')} className={primary}>{aiBusy ? 'Codex 正在分析…' : 'AI 找论据 / 案例 / 反例'}</button>{aiBusy && <button onClick={() => { ai.current?.abort(); setAiBusy(false); }} className={button}>停止</button>}{selection && <button onClick={() => setSelection('')} className={button}>改用全文</button>}</div></section>
          {searchError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{searchError}</p>}
          {searching && <p role="status" className="text-sm text-muted">正在检索已确认的知识块…</p>}
          {!searching && !candidates.length && <div className="rounded-xl border border-dashed border-line p-5 text-sm leading-6 text-muted">{context.trim() ? '没有找到匹配材料。换个关键词，或先去 AI 工作台提炼相关资料；这里不会生成虚构论据。' : '先写标题或一句观点，相关知识会出现在这里。'}</div>}
          {analysis && <div className="rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900"><strong>还缺什么证据</strong>{analysis.gaps.length ? <ul className="mt-2 list-disc pl-4">{analysis.gaps.map((gap,index) => <li key={index}>{gap}</li>)}</ul> : <p>AI 未提出额外缺口，不代表事实已经核验。</p>}<p className="mt-2">本次：{analysis.model || '未调用模型'} · 仅分析关键词召回的 {candidates.length} 条候选，不代表全库穷尽检索。</p></div>}
          {groups.map(group => {
            const items = analysis ? candidates.filter(item => analysis.suggestions.some(s => s.blockId === item.block.id && s.role === group)) : candidates;
            if (!items.length && !analysis) return null;
            return <section key={group} className="space-y-3"><h2 className="text-sm font-semibold">{group} <span className="font-normal text-muted">{items.length}</span></h2>{!items.length && <p className="text-xs text-muted">本次候选中没有合适材料，不强行补齐。</p>}{items.map(candidate => {
              const suggestion = analysis?.suggestions.find(item => item.blockId === candidate.block.id);
              return <article key={candidate.block.id} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-terra">{candidate.block.kind} · 当前用于 {candidate.usedDrafts} 篇草稿</p><blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-terra/30 bg-surface-2 p-3 text-sm leading-6">{candidate.block.quote}</blockquote><p className="mt-2 text-xs text-muted">{candidate.sourceTitle} · {candidate.block.locator} · 未独立核验</p>{suggestion && <div className="mt-3 space-y-1 rounded-xl bg-terra-wash p-3 text-xs leading-6"><p>为什么相关：{suggestion.reason}</p><p>使用边界：{suggestion.caution}</p></div>}<div className="mt-3 flex flex-wrap gap-2"><button onClick={() => viewOriginal(candidate)} className={button}>核对原文</button><button disabled={busy || !ready} onClick={() => mutate('insert', { blockId: candidate.block.id, mode: 'quote', position: Math.min(cursor.current, current.current?.body.length || 0) })} className={button}>插入原文</button><button disabled={busy || aiBusy || !draft} onClick={() => askAI('rewrite', candidate.block.id)} className={button}>AI 融入预览</button><button disabled={busy || !ready} onClick={() => mutate('memo', { blockId: candidate.block.id })} className={button}>存引用备忘</button></div>{original?.id === candidate.block.id && <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs leading-6">{original.text}</pre>}</article>;
            })}</section>;
          })}
        </>}
        <div className={leftTab === 'AI 快搜' ? '' : 'hidden'}><WebSearchPanel context={`${draft?.title || ''}\n${selection || draft?.body.slice(-1500) || ''}`} /></div>
      </aside>
      <main className={`${mobile === 'write' ? '' : 'hidden'} min-w-0 space-y-4 lg:block`}>
        <InspirationPicker thoughts={thoughts} drafts={drafts} activeDraftId={draft?.id} reopenToken={pickerOpenToken} hydrated={thoughtsHydrated} disabled={!ready || busy} onPick={pickThought} />
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">我的正文</h2><button disabled={!ready || busy} onClick={() => exclusive(async () => { const value = await request({ action: 'create' }); choose(value); accept(value); })} className={button}>＋ 新建草稿</button></div>
          {draft?.sourceThoughtId && <p className="mt-3 text-xs leading-5 text-terra">这篇草稿来自灵感随笔；编辑正文不会改动原随笔。<button type="button" disabled={busy} onClick={() => { setPickerOpenToken(value => value + 1); document.querySelector('[aria-label="从灵感随笔选择"]')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }} className="ml-2 underline disabled:opacity-40">换一条灵感</button><Link href="/inspire" className="ml-3 underline">查看灵感随笔 ↗</Link></p>}
          {!!drafts.length && <div className="mt-3 flex flex-wrap items-center gap-2"><select aria-label="选择知识写作草稿" disabled={busy} value={draft?.id || ''} onChange={event => { const id = event.target.value; void exclusive(async () => { const data: WritingState = await request(); setDrafts(data.drafts); choose(data.drafts.find(item => item.id === id) || null); setStatus(id ? '已载入本机草稿' : '已清空当前选择；草稿仍保留'); }); }} className={`${field} min-w-0 flex-1`}><option value="">暂不选择草稿</option>{drafts.map(item => <option key={item.id} value={item.id}>{item.title || item.body.slice(0, 25) || '未命名草稿'}</option>)}</select><button type="button" disabled={busy || !draft} onClick={() => void exclusive(async () => { choose(null); setStatus('已清空当前选择；草稿仍保留'); })} className={button}>清空选择</button></div>}
          {!draft ? <div className="py-12 text-center text-sm text-muted">{ready ? '新建一篇草稿，或导入已有旧稿，开始边查边写。' : '正在连接…仅本机工作站可以使用。'}</div> : <>
            <input aria-label="知识草稿标题" value={draft.title} maxLength={500} disabled={busy} onChange={event => edit({ title: event.target.value })} placeholder="这次我想写什么？" className={`${field} mt-4 font-semibold`} />
            <textarea ref={editor} aria-label="知识草稿正文" value={draft.body} maxLength={200000} disabled={busy} onChange={event => { cursor.current = event.target.selectionStart; setSelection(''); edit({ body: event.target.value }); }} onSelect={event => { const target = event.currentTarget; cursor.current = target.selectionEnd; setSelection(target.value.slice(target.selectionStart, target.selectionEnd)); }} placeholder="先写你的判断，再看看有哪些论据、案例和反例。引用会插在光标位置，不覆盖你选中的原文。" className={`${field} mt-3 min-h-[430px] resize-y bg-bg text-[15px] leading-8`} />
            <p className="mt-2 text-xs text-muted">{status} · {Array.from(cleanBody(draft)).length} 字</p><p className="mt-1 text-xs leading-5 text-muted">〔引…〕用于追踪出处。修改引用文字后会标为待复核；删除标记后不再计为使用。复制纯正文会自动去掉标记。</p>
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => copy()} className={primary}>复制纯正文</button><button onClick={() => copy(true)} className={button}>复制含出处</button><button onClick={exportDraft} className={button}>导出草稿备份</button><button disabled={busy} onClick={() => exclusive(async () => setStatus('已保存到本机知识库'))} className={button}>保存</button></div>
          </>}
        </section>
        {preview && <section aria-label="AI 改写预览" className="rounded-2xl border border-terra bg-white p-5"><h2 className="font-semibold text-terra">AI 融入预览 · 尚未修改正文</h2><textarea aria-label="调整 AI 改写" maxLength={6000} value={preview.text} onChange={event => setPreview({ ...preview, text: event.target.value })} className={`${field} mt-3 min-h-36 leading-7`} /><p className="mt-2 text-xs leading-6 text-amber-800">{preview.caution || '这是 AI 改写，不是来源原话。请核对数字、归属和事实。'}</p><div className="mt-3 flex gap-2"><button disabled={busy || !preview.text.trim() || draft?.id !== preview.draftId || draft?.body !== preview.body} onClick={() => mutate('insert', { blockId: preview.blockId, mode: 'paraphrase', text: preview.text, position: Math.min(cursor.current, current.current?.body.length || 0) })} className={primary}>确认插入光标处</button><button onClick={() => setPreview(null)} className={button}>不采用</button></div></section>}
        {draft && <section className="rounded-2xl border border-line bg-white p-5"><h2 className="font-semibold">引用与使用记录</h2><p className="mt-1 text-xs text-muted">摘录备忘不计使用；同一知识块在一篇稿里插入多次，只计一篇稿。</p><div className="mt-4 space-y-3">{draft.references.filter(ref => ref.status !== 'removed').map(ref => <article key={ref.id} className="rounded-xl border border-line bg-bg p-3"><p className="text-xs font-semibold text-terra">{ref.marker || '备忘'} · {ref.status === 'active' ? '正文使用中' : ref.status === 'modified' ? '正文已改写，需重新核对' : '尚未插入'} · {ref.mode === 'paraphrase' ? 'AI 改写' : '原文摘录'}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6">{ref.quote}</p><p className="mt-2 text-xs text-muted">{ref.sourceTitle} · {ref.locator}</p><div className="mt-2 flex flex-wrap gap-3 text-xs"><button disabled={busy} onClick={() => mutate('remove', { referenceId: ref.id })} className="text-terra">{ref.status === 'active' ? '撤销这次插入' : ref.status === 'modified' ? '移除标记（保留改写）' : '移除备忘'}</button>{ref.sourceUrl && <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className="text-terra">打开出处 ↗</a>}{ref.blockId && <Link href={`/resources?block=${encodeURIComponent(ref.blockId)}`} className="text-terra">查看知识块 ↗</Link>}</div></article>)}</div>{!draft.references.some(ref => ref.status !== 'removed') && <p className="mt-4 text-sm text-muted">还没有引用；从左边插入，出处会自动留在这里。</p>}
          <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold">记录实际发布（不会替你发送）</summary><p className="mt-2 text-xs text-muted">发布后粘贴链接确认。只记录此刻正文使用中的引用，与复制操作分开统计。</p><input aria-label="已发布链接" type="url" value={publication} onChange={event => setPublication(event.target.value)} className={`${field} mt-3`} placeholder="https://…"/><button disabled={busy || !publication.trim()} onClick={() => mutate('publish', { url: publication })} className={`${button} mt-2`}>确认已发布并记录</button>{draft.publications.map(pub => <div key={pub.id} className="mt-3 flex items-center gap-3 text-xs"><a href={pub.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-terra">{pub.url}</a><button disabled={busy} onClick={() => mutate('unpublish', { publicationId: pub.id })} className="shrink-0 text-muted">撤销记录</button></div>)}</details>
        </section>}
      </main>
    </div><p className="mt-6 text-xs leading-6 text-muted">知识与新草稿保存在这台电脑。原始素材仍保留原入口；本机 Codex 分析会使用你的账号额度，关闭电脑后不可运行。尚未开放手机远程同步。</p>
  </div>;
}
