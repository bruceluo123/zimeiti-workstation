'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BLOCK_KINDS, BUNDLE_TYPE_LABELS, type AssistantState } from '@/types/assistant';
import { SourceLibrary } from '@/components/write/SourceLibrary';
import { ResourcesPanel } from '@/components/inspire/InspirePage';
import { assistantRequest } from './client';
import { KnowledgeCard } from './KnowledgeCards';
import { LibraryJobs } from './SourceKnowledgePanel';
import { QuickCapture } from './QuickCapture';

export function ResourcesPage() {
  const params = useSearchParams();
  const [state, setState] = useState<AssistantState | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('知识积木');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('全部');
  const [review, setReview] = useState('all');
  const [librarySource, setLibrarySource] = useState('');
  const [sourcePreview, setSourcePreview] = useState<string>();

  async function refresh() {
    try {
      const data: AssistantState = await assistantRequest();
      setState(data);
      if (!state) {
        const id = new URLSearchParams(window.location.search).get('block');
        const found = data.blocks.find(block => block.id === id);
        if (found) setQuery(found.title);
      }
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取失败');
    }
  }

  useEffect(() => {
    setReview(params.get('review') === 'pending' ? 'pending' : 'all');
    setLibrarySource(params.get('librarySource') || '');
    setSourcePreview(params.get('source') || undefined);
    setTab(params.get('source') ? '来源资料' : '知识积木');
    void refresh();
  }, [params]);
  const active = state?.jobs.some(job => ['queued', 'running'].includes(job.status));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(timer);
  }, [active]);

  const approvedBlocks = state?.blocks.filter(block => block.status === 'approved') || [];
  const pendingBlocks = state?.blocks.filter(block => block.status === 'pending') || [];
  const blocks = (state?.blocks || []).filter(block =>
    block.status !== 'rejected' && (review === 'all' || block.status === review) &&
    (!librarySource || state?.sources.some(source => source.id === block.sourceId && source.librarySourceIds?.includes(librarySource))) &&
    (kind === '全部' || block.kind === kind) &&
    `${block.bundleTitle || ''} ${block.bundleType || ''} ${block.bundleRole || ''} ${block.title} ${block.body} ${block.quote} ${block.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
  );
  const bundleGroups = Array.from(blocks.filter(block => block.bundleId).reduce((groups, block) => {
    const current = groups.get(block.bundleId!) || [];
    current.push(block); groups.set(block.bundleId!, current); return groups;
  }, new Map<string, typeof blocks>()).values());
  const legacyBlocks = blocks.filter(block => !block.bundleId);

  function exportBackup() {
    if (!state) return;
    // Download full source text too: exported metadata alone cannot recover provenance.
    Promise.all(state.sources.map(source => assistantRequest(`?source=${encodeURIComponent(source.id)}`))).then(sources => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state, sources }, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `麦满分知识库-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(cause => setError(cause instanceof Error ? cause.message : '导出失败'));
  }

  return <div className="mx-auto max-w-[1300px] space-y-6 px-4 py-7 lg:px-8">
    <header className="flex flex-wrap justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-terra">留下来源 · 反复使用</p>
        <h1 className="mt-2 text-3xl font-semibold">资源库</h1>
        <p className="mt-2 text-sm text-muted">灵感留在随笔里，原始资料与可引用的知识积木留在这里。</p>
      </div>
      <Link href="/assistant" className="self-center rounded-xl bg-terra px-4 py-3 text-sm text-white">让 Codex 整理资料 →</Link>
    </header>
    <QuickCapture onStored={() => { setTab('知识积木'); void refresh(); }} />
    <nav aria-label="资源库分区" className="flex flex-wrap gap-2">
      {['知识积木', '来源资料', '随笔精选'].map(item => <button key={item} onClick={() => { setTab(item); void refresh(); }} className={`rounded-full border px-4 py-2 text-sm ${tab === item ? 'border-terra bg-terra text-white' : 'border-line bg-white'}`}>{item}</button>)}
    </nav>
    {tab === '知识积木' && <>
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
      <div className="flex flex-wrap gap-2">{[['all', '全部'], ['pending', `待确认 ${pendingBlocks.length}`], ['approved', `已入库 ${approvedBlocks.length}`]].map(([value, label]) => <button key={value} onClick={() => setReview(value)} className={`rounded-xl border px-4 py-2 text-sm ${review === value ? 'border-terra bg-terra-wash text-terra' : 'border-line bg-white'}`}>{label}</button>)}</div>
      {librarySource && <p className="text-xs text-terra">正在查看所选素材的知识积木 <button onClick={() => setLibrarySource('')} className="ml-3 underline">查看全部来源</button></p>}
      {state && <LibraryJobs state={state} refresh={refresh} />}
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="搜索知识积木" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索观点、事实、案例、原文或标签" className="min-w-0 flex-1 rounded-xl border border-line bg-white p-3 text-sm" />
        <button onClick={refresh} className="px-3 text-sm text-terra">刷新</button>
        <button disabled={!state} onClick={exportBackup} className="px-3 text-sm text-terra">导出备份</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {['全部', ...BLOCK_KINDS].map(item => <button key={item} onClick={() => setKind(item)} className={`rounded-full border px-3 py-1.5 text-xs ${kind === item ? 'border-terra bg-terra-wash text-terra' : 'border-line bg-white'}`}>{item}</button>)}
      </div>
      <p className="text-xs text-muted">{bundleGroups.length} 个主题套件 · {approvedBlocks.length} 个已入库原句 · {pendingBlocks.length} 个待确认 · 写作检索命中一块时会带出同主题内容</p>
      <div className="space-y-5">
        {bundleGroups.map(group => <section key={group[0].bundleId} className="overflow-hidden rounded-[22px] border border-terra/20 bg-[#f5f9f6]">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-terra/10 px-4 py-3 sm:px-5"><div><p className="text-[10px] font-semibold tracking-[1.5px] text-terra">主题知识套件{group[0].bundleType ? ` · ${BUNDLE_TYPE_LABELS[group[0].bundleType]}` : ''}</p><h2 className="mt-1 text-lg font-semibold">{group[0].bundleTitle}</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs text-muted">{group.length} 块原文积木</span></header>
          <div className="grid items-start gap-3 p-3 sm:p-4 lg:grid-cols-2">{group.map(block => <KnowledgeCard key={block.id} block={block} sources={state?.sources || []} onChange={refresh} />)}</div>
        </section>)}
        {legacyBlocks.length > 0 && <section><p className="mb-3 text-xs font-semibold text-muted">旧版独立积木 · 可在“来源资料”中升级为主题套件</p><div className="grid items-start gap-4 lg:grid-cols-2">{legacyBlocks.map(block => <KnowledgeCard key={block.id} block={block} sources={state?.sources || []} onChange={refresh} />)}</div></section>}
      </div>
      {state && !error && !blocks.length && (approvedBlocks.length + pendingBlocks.length === 0 ?
        <div className="rounded-2xl border border-dashed border-line p-8 text-sm text-muted">
          <p>从来源资料中选择文章、帖子或书籍，展开“提炼为知识积木”。提炼结果会显示在这里，检查后即可确认入库。</p>
          <button onClick={() => setTab('来源资料')} className="mt-4 rounded-xl border border-terra px-4 py-2 text-terra">选择来源并提炼 →</button>
        </div> :
        <div className="rounded-2xl border border-dashed border-line p-8 text-sm text-muted">没有符合当前搜索或分类的知识块。试试清除搜索词或切换到“全部”。</div>
      )}
    </>}
    {tab === '来源资料' && <SourceLibrary key={sourcePreview || 'library'} initialSourceId={sourcePreview} />}
    {tab === '随笔精选' && <ResourcesPanel />}
  </div>;
}
