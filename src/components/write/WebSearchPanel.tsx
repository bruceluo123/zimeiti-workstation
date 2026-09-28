'use client';

import { useEffect, useRef, useState } from 'react';

type Source = { title: string; publisher: string; url: string; note: string };
type SearchResult = { answer: string; sources: Source[]; model: string; question: string };

export function WebSearchPanel({ context }: { context: string }) {
  const [question, setQuestion] = useState('');
  const [model, setModel] = useState('gpt-5.6-luna');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [followingUp, setFollowingUp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const active = useRef<AbortController | null>(null);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function search() {
    const asked = question.trim();
    if (busy || asked.length < 2) return;
    const previous = followingUp && result ? { question: result.question, answer: result.answer } : null;
    const oldResult = result;
    const controller = new AbortController();
    active.current = controller; setBusy(true); setError(''); setCopied(false); setResult(null);
    try {
      const response = await fetch('/api/assistant/web-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: asked, context: context.slice(0, 3000), previous, model }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '搜索失败，请重试');
      if (!controller.signal.aborted) { setResult({ ...data, question: asked }); setFollowingUp(false); }
    } catch (cause) {
      setResult(oldResult);
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '搜索失败，请重试');
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  async function copyAnswer() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText([result.answer, ...result.sources.map(item => `${item.publisher} · ${item.title}\n${item.url}`)].join('\n\n'));
      setCopied(true);
    } catch { setError('复制失败，请手动选中答案和出处。'); }
  }

  return <section className="space-y-4" aria-label="AI 快搜">
    <div className="rounded-2xl border border-line bg-white p-4">
      <h2 className="text-base font-semibold">AI 快搜</h2>
      <p className="mt-1 text-xs leading-5 text-muted">问它是什么、怎么做、有什么区别，也可以找例子。先给简短答案，再列网页出处。</p>
      {followingUp && <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs"><span>正在追问上一个答案</span><button type="button" onClick={() => { setFollowingUp(false); setQuestion(''); setResult(null); questionInput.current?.focus(); }} className="text-terra underline">换个新问题</button></div>}
      <label htmlFor="web-search-question" className="mt-4 block text-sm font-semibold">你想知道什么？</label>
      <textarea ref={questionInput} id="web-search-question" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } }} disabled={busy} maxLength={1000} placeholder="例如：蛇口贝赛思是什么？或：找一个支持这段观点的例子" className="mt-2 min-h-24 w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-terra disabled:opacity-60" />
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">模型<select aria-label="搜索模型" value={model} onChange={event => setModel(event.target.value)} disabled={busy} className="ml-2 rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink"><option value="gpt-5.6-luna">Luna · 快速</option><option value="gpt-5.6-terra">Terra · 深一点</option></select></label>
        <button type="button" disabled={busy || question.trim().length < 2} onClick={search} className="min-h-10 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{busy ? '正在搜索…' : followingUp ? '继续追问' : '搜索'}</button>
        {busy && <button type="button" onClick={() => active.current?.abort()} className="min-h-10 rounded-xl border border-line bg-white px-3 py-2 text-xs">停止</button>}
      </div>
      <p className="mt-2 text-xs text-muted">按 Enter 搜索，Shift + Enter 换行。搜索会使用 Codex 额度，不会改动正文。</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {busy && <p role="status" className="text-sm text-muted">正在查网页，请稍候…</p>}
    {result && <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-medium text-terra">AI 快搜 · {result.model === 'gpt-5.6-terra' ? 'Terra' : 'Luna'}</p>
      <h3 className="mt-2 text-sm font-semibold">直接答案</h3>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7">{result.answer || '没查到能核实的网页来源。请换个问法再试。'}</p>
      {!!result.sources.length && <div className="mt-4 space-y-3 border-t border-line pt-4"><h4 className="text-xs font-semibold text-muted">网页出处</h4>{result.sources.map(item => <div key={item.url} className="rounded-xl bg-surface-2 p-3"><a href={item.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium leading-6 text-terra underline">{item.title} ↗</a><p className="mt-1 text-xs text-muted">{item.publisher}</p>{item.note && <p className="mt-1 text-xs leading-5 text-ink-soft">{item.note}</p>}</div>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={copyAnswer} disabled={!result.answer} className="min-h-9 rounded-xl border border-line bg-white px-3 py-2 text-xs disabled:opacity-40">{copied ? '已复制答案与出处' : '复制答案与出处'}</button>{!!result.answer && <button type="button" onClick={() => { setFollowingUp(true); setQuestion(''); questionInput.current?.focus(); }} className="min-h-9 rounded-xl border border-line bg-white px-3 py-2 text-xs">继续追问</button>}</div>
    </div>}
  </section>;
}
