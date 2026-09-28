'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SourceDocument } from '@/types/source';
import type { AssistantState } from '@/types/assistant';
import { assistantRequest } from './client';

const button = 'rounded-lg border border-line bg-white px-3 py-2 text-xs disabled:opacity-40';
const requestText = '按通用主题知识套件提炼正文或视频口播：先判断主题属于观点论证、教程方法、案例复盘、访谈观点、数据事实、概念模型或混合结构，再提取原文中实际存在的说法、理由、证据、步骤、案例、结果、边界等角色。每块只保存一段连续原句，不拼接、不改写、不存 AI 总结；缺少的结构不要编造。作者说法不等于已经核实的事实。';

export function LibraryJobs({ state, refresh }: { state: AssistantState; refresh: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = state.jobs.some(job => ['queued', 'running'].includes(job.status));
  async function change(action: 'cancel' | 'retry', id: string) {
    setBusy(true); setError('');
    try { await assistantRequest('', { action, id }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    {state.jobs.filter(job => job.origin === 'library').filter((job, index, jobs) => job.status !== 'completed' || index >= jobs.length - 3).reverse().map(job => <div key={job.id} className="rounded-xl bg-surface-2 p-3 text-xs leading-6">
      <p>{job.status === 'failed' ? `提炼失败：${job.error}` : job.status === 'cancelled' ? '任务已停止，已完成的结果已保留' : job.status === 'completed' ? `提炼完成 · ${state.blocks.filter(block => block.conversationId === job.conversationId && block.status === 'pending').length} 个待确认知识块` : job.progress || '正在排队提炼…'}</p>
      <div className="flex flex-wrap gap-3 text-terra">
        <Link href="/resources?review=pending">查看待确认知识块 →</Link>
        {['failed', 'cancelled'].includes(job.status) && <button disabled={busy || active} onClick={() => void change('retry', job.id)}>从断点继续</button>}
        {['queued', 'running'].includes(job.status) && <button disabled={busy} onClick={() => void change('cancel', job.id)}>停止任务</button>}
      </div>
    </div>)}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}

export function SourceKnowledgePanel({ sources }: { sources: SourceDocument[] }) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [models, setModels] = useState<{ id: string; isDefault: boolean }[]>([]);
  const [model, setModel] = useState('');
  const [message, setMessage] = useState(requestText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => { setState(await assistantRequest()); }, []);
  useEffect(() => { refresh().catch(cause => setError(cause.message)); }, [refresh]);
  const active = state?.jobs.some(job => ['queued', 'running'].includes(job.status));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { refresh().catch(cause => setError(cause.message)); }, 2500);
    return () => window.clearInterval(timer);
  }, [active, refresh]);
  const eligible = sources.filter(source => source.body.trim() && source.coverage !== 'preview' && source.captureMethod !== 'link_only' && !['collecting', 'transcribing', 'analyzing', 'failed'].includes(source.status || ''));
  const chosen = eligible.filter(source => selected.includes(source.id) && !hasBundles(source.id));
  function related(id: string) { return state?.sources.filter(source => source.librarySourceIds?.includes(id)) || []; }
  function hasExtraction(id: string) {
    const ids = related(id).map(source => source.id);
    return state?.blocks.some(block => ids.includes(block.sourceId)) || state?.jobs.some(job => job.mode === 'extract' && job.sourceIds?.some(sourceId => ids.includes(sourceId)));
  }
  function hasBundles(id: string) {
    const ids = related(id).map(source => source.id);
    return state?.blocks.some(block => ids.includes(block.sourceId) && block.bundleId && block.bundleType) || state?.jobs.some(job => job.schemaVersion === 3 && job.sourceIds?.some(sourceId => ids.includes(sourceId)));
  }
  async function connect() {
    setBusy(true); setError('');
    try {
      const connection = await assistantRequest('/status');
      setModels(connection.models);
      setModel(connection.models.find((item: { isDefault: boolean }) => item.isDefault)?.id || connection.models[0]?.id || '');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '连接失败'); }
    finally { setBusy(false); }
  }
  async function extract() {
    setBusy(true); setError(''); setNotice('');
    try {
      const force = chosen.some(source => hasExtraction(source.id) && !hasBundles(source.id));
      const result = await assistantRequest('/library', { model, message, force, sources: chosen.map(source => ({ id: source.id, title: source.title, url: source.url, author: source.author, body: source.body, coverage: source.coverage, status: source.status, captureMethod: source.captureMethod })) });
      setNotice(result.jobId ? `已开始生成 ${result.sourceIds.length} 份主题套件${result.skipped.length ? `，跳过 ${result.skipped.length} 份已有新版记录` : ''}。原句仍需在“待确认”中核对。` : '这些正文已经有主题套件，没有重复分析。');
      setSelected([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '提炼失败'); }
    finally { try { await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : '状态读取失败'); } setBusy(false); }
  }
  return <div className="mb-4 rounded-2xl border border-terra/20 bg-terra-wash/40 p-4">
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-terra">生成主题知识套件 · 当前筛选 {eligible.length} 份可用素材</summary>
      <p className="mt-2 text-xs leading-6 text-muted">勾选原文，由本机 Codex 先识别观点、教程、案例、访谈、数据或概念结构，再把同一主题下的原句关联起来。知识块仍是可核对的连续原文，视频转写仍需校对。旧版素材可以升级一次，已有通用套件不会重复消耗额度。</p>
      <div className="my-3 flex flex-wrap gap-2">
        <button className={button} disabled={!state || busy || active} onClick={() => setSelected(eligible.filter(source => !hasBundles(source.id)).slice(0, 10).map(source => source.id))}>选前 10 份未升级</button>
        <button className={button} onClick={() => setSelected([])}>清空选择</button>
        <button className={button} disabled={busy} onClick={() => void refresh().catch(cause => setError(cause.message))}>刷新进度</button>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {eligible.map(source => {
          const ids = related(source.id).map(item => item.id);
          const blocks = state?.blocks.filter(block => ids.includes(block.sourceId)) || [];
          return <div key={source.id} className="rounded-xl bg-white p-3 text-xs">
            <label className="flex gap-2"><input type="checkbox" aria-label={`选择提炼：${source.title}`} checked={chosen.some(item => item.id === source.id)} disabled={busy || active || hasBundles(source.id) || (chosen.length >= 10 && !selected.includes(source.id))} onChange={event => setSelected(current => event.target.checked ? [...current, source.id] : current.filter(id => id !== source.id))} /><span>{source.title}</span></label>
            {hasExtraction(source.id) ? <Link href={`/resources?librarySource=${encodeURIComponent(source.id)}`} className="mt-2 inline-block text-terra">{hasBundles(source.id) ? '已有主题套件' : '旧版摘句，可升级'} · {blocks.filter(block => block.status === 'pending').length} 待确认 · {blocks.filter(block => block.status === 'approved').length} 已入库 →</Link> : ids.length > 0 && <p className="mt-2 text-muted">原文已同步，尚未提炼</p>}
          </div>;
        })}
        {!eligible.length && <p className="text-xs text-muted">当前筛选下还没有可用正文。</p>}
      </div>
      <label className="mt-3 block text-xs text-muted">提炼要求<textarea aria-label="素材提炼要求" value={message} onChange={event => setMessage(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-line bg-white p-3 text-sm text-ink" /></label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={busy || active} onClick={() => void connect()} className={button}>{models.length ? '重新检查连接' : '连接本机 Codex'}</button>
        {models.length > 0 && <select aria-label="素材提炼模型" value={model} onChange={event => setModel(event.target.value)} className="max-w-64 rounded-lg border border-line bg-white p-2 text-xs">{models.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select>}
        <button onClick={() => void extract()} disabled={busy || active || !model || !message.trim() || !chosen.length || chosen.length > 10} className="rounded-xl bg-terra px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{active ? '正在生成…' : busy ? '请稍候…' : `生成 ${chosen.length} 份主题套件`}</button>
        <span className="text-xs text-muted">占用本机 Codex 额度</span>
      </div>
    </details>
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-xs leading-6 text-terra">{notice}</p>}
    {state && <div className="mt-3"><LibraryJobs state={state} refresh={refresh} /></div>}
  </div>;
}
