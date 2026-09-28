'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPaste, Clock3, LoaderCircle, PackageOpen, Sparkles, X } from 'lucide-react';
import { PLATFORM_LABELS } from '@/lib/sources/platform';
import { parseQuickCapture } from '@/lib/sources/quick';
import type { AssistantState } from '@/types/assistant';
import type { SourceDocument } from '@/types/source';

type Result = { sourceId?: string; jobId?: string; queued?: boolean; duplicate?: boolean; warning?: string; accepted?: boolean; autoExtract?: boolean; error?: string };
type CaptureReceipt = {
  sourceId?: string; jobId?: string; label: string; createdAt: string;
  status: 'working' | 'completed' | 'saved' | 'failed'; detail: string; pending?: number;
};

const RECEIPT_KEY = 'zmt-quick-capture-receipt-v1';
const DISMISSED_KEY = 'zmt-quick-capture-dismissed-at-v1';
const sourceStages: Record<string, string> = {
  collecting: '正在读取链接', transcribing: '正在识别视频口播', captured: '口播已取得，准备整理',
  analyzing: '正在整理素材', ready: '原文已保存，准备拆分', failed: '素材读取失败',
};

function rememberReceipt(value: CaptureReceipt | null) {
  if (typeof window === 'undefined') return;
  if (value) window.localStorage.setItem(RECEIPT_KEY, JSON.stringify(value));
  else window.localStorage.removeItem(RECEIPT_KEY);
}

function storedReceipt(): CaptureReceipt | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(RECEIPT_KEY) || 'null') as CaptureReceipt | null;
    return value && Date.now() - Date.parse(value.createdAt) < 24 * 60 * 60 * 1000 ? value : null;
  } catch { return null; }
}

async function inspectReceipt(seed: CaptureReceipt | null, dismissedAt = 0): Promise<CaptureReceipt | null> {
  const [assistantResponse, libraryResponse] = await Promise.all([
    fetch('/api/assistant', { cache: 'no-store' }),
    fetch('/api/sources/library', { cache: 'no-store' }),
  ]);
  if (!assistantResponse.ok) return seed;
  const assistant = await assistantResponse.json() as AssistantState;
  const library = libraryResponse.ok ? (await libraryResponse.json() as { sources?: SourceDocument[] }).sources || [] : [];
  const recentJobs = assistant.jobs.filter(job => job.origin === 'library')
    .sort((a, b) => Date.parse(b.createdAt || b.updatedAt || '') - Date.parse(a.createdAt || a.updatedAt || ''));
  let job = seed?.jobId ? assistant.jobs.find(item => item.id === seed.jobId) : undefined;
  let assistantSource = seed?.sourceId ? assistant.sources.find(source => source.librarySourceIds?.includes(seed.sourceId!)) : undefined;
  if (!job && assistantSource) job = recentJobs.find(item => item.sourceIds?.includes(assistantSource!.id));
  if (!job && !seed) {
    job = recentJobs[0];
    const jobTime = Date.parse(job?.createdAt || job?.updatedAt || '');
    if (job && (Date.now() - jobTime > 24 * 60 * 60 * 1000 || jobTime <= dismissedAt)) job = undefined;
    assistantSource = job ? assistant.sources.find(source => job!.sourceIds?.includes(source.id)) : undefined;
  }
  const sourceId = seed?.sourceId || assistantSource?.librarySourceIds?.[0];
  const source = sourceId ? library.find(item => item.id === sourceId) : undefined;
  const label = seed?.label || assistantSource?.title || source?.title || '最近提交的资料';
  const createdAt = seed?.createdAt || job?.createdAt || source?.createdAt || new Date().toISOString();
  if (job) {
    const sourceIds = new Set(job.sourceIds || []);
    const pending = assistant.blocks.filter(block => sourceIds.has(block.sourceId) && block.status === 'pending').length;
    if (job.status === 'completed') return { sourceId, jobId: job.id, label, createdAt, status: 'completed', pending, detail: pending ? `识别与拆分完成，生成 ${pending} 条待确认知识块。` : '识别与拆分已经完成。' };
    if (job.status === 'failed' || job.status === 'cancelled') return { sourceId, jobId: job.id, label, createdAt, status: 'failed', detail: job.error || '拆分没有完成，原始资料仍然保留。' };
    return { sourceId, jobId: job.id, label, createdAt, status: 'working', detail: job.progress || (job.status === 'queued' ? '原文已保存，正在等待 Codex 拆分。' : 'Codex 正在挑选可复用的原文原句。') };
  }
  if (source?.status === 'failed') return { sourceId, label, createdAt, status: 'failed', detail: source.error || '没有取得正文，原链接已经保留。' };
  if (source) {
    const waiting = Date.now() - Date.parse(createdAt) < 2 * 60 * 1000;
    return { sourceId, label, createdAt, status: source.status === 'ready' && !waiting ? 'saved' : 'working', detail: source.status === 'ready' && !waiting ? '原文已经保存，但还没有生成知识块，可在“来源资料”里继续提炼。' : sourceStages[source.status || 'ready'] || '正在处理资料。' };
  }
  return seed;
}

export function QuickCapture({ compact = false, onStored }: { compact?: boolean; onStored?: () => void }) {
  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<CaptureReceipt | null>(null);
  const detected = useMemo(() => {
    try { return input.trim() ? parseQuickCapture(input, title) : null; } catch { return null; }
  }, [input, title]);

  useEffect(() => {
    let disposed = false;
    const restore = async () => {
      try {
        const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
        const next = await inspectReceipt(storedReceipt(), dismissedAt);
        if (!disposed && next) { setReceipt(next); rememberReceipt(next); }
      } catch { /* The capture itself remains on disk; retry when the page becomes visible again. */ }
    };
    void restore();
    const visible = () => { if (document.visibilityState === 'visible') void restore(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; document.removeEventListener('visibilitychange', visible); };
  }, []);

  useEffect(() => {
    if (receipt?.status !== 'working') return;
    const timer = window.setInterval(() => {
      void inspectReceipt(receipt).then(next => { if (next) { setReceipt(next); rememberReceipt(next); } }).catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [receipt?.sourceId, receipt?.jobId, receipt?.status]);

  async function defaultModel() {
    const response = await fetch('/api/assistant/status', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.connected || !data.models?.length) throw new Error(data.error || '本机 Codex 尚未连接');
    return data.models.find((item: { isDefault: boolean }) => item.isDefault)?.id || data.models[0].id;
  }

  async function pasteClipboard() {
    setError('');
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) throw new Error('剪贴板里没有文字或链接');
      setInput(value);
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('没有') ? cause.message : '浏览器没有允许读取剪贴板，请在输入框里按 Ctrl+V');
    }
  }

  async function submit() {
    if (!input.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const parsed = parseQuickCapture(input, title);
      const model = await defaultModel();
      const response = parsed.mode === 'collect'
        ? await fetch('/api/sources/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: parsed.url, autoExtract: true, model }) })
        : await fetch('/api/sources/quick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, title, model }) });
      const result = await response.json() as Result;
      if (!response.ok) throw new Error(result.error || '入库失败，请重试');
      const nextReceipt: CaptureReceipt = {
        sourceId: result.sourceId, jobId: result.jobId,
        label: parsed.mode === 'collect' ? `${PLATFORM_LABELS[parsed.platform]}内容` : parsed.mode === 'article-url' ? '公开文章' : parsed.title,
        createdAt: new Date().toISOString(), status: result.warning && !result.queued ? 'saved' : 'working',
        detail: result.warning || (parsed.mode === 'collect' ? '链接已收下，正在读取正文或识别视频口播。' : '原文已保存，正在等待 Codex 拆分。'),
      };
      window.localStorage.removeItem(DISMISSED_KEY);
      setReceipt(nextReceipt); rememberReceipt(nextReceipt);
      setInput(''); setTitle(''); onStored?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '入库失败，请重试'); }
    finally { setBusy(false); }
  }

  return <section className={`overflow-hidden rounded-[22px] border border-terra/20 bg-white shadow-[0_18px_45px_-38px_rgba(15,70,53,.65)] ${compact ? '' : 'p-4 sm:p-5'}`}>
    <div className={compact ? 'grid md:grid-cols-[220px_1fr]' : ''}>
      <div className={`${compact ? 'border-b border-line bg-[#f1f7f3] px-5 py-5 md:border-b-0 md:border-r' : 'flex flex-wrap items-start justify-between gap-3'}`}>
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[1.5px] text-terra"><PackageOpen size={14}/>快速入库</p>
          <h2 className={`mt-1 font-semibold ${compact ? 'text-lg' : 'text-xl'}`}>看到什么，就先收进来</h2>
          {!compact && <p className="mt-1 text-xs leading-5 text-muted">文字保存原文；平台链接读取正文或视频口播，再交给 Codex 拆成待确认知识块。</p>}
        </div>
      </div>
      <div className={compact ? 'p-4 sm:p-5' : 'mt-4'}>
        <textarea
          aria-label="快速入库内容"
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submit(); }}
          placeholder="粘贴一段文字、文章正文，或 X / 微博 / 公众号 / 小红书 / 抖音的具体内容链接……"
          className={`w-full resize-y rounded-2xl border border-line bg-[#fbfcfb] px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-muted focus:border-terra ${compact ? 'min-h-[104px]' : 'min-h-[126px]'}`}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <button type="button" disabled={busy} onClick={() => void pasteClipboard()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-ink-soft disabled:opacity-40"><ClipboardPaste size={14}/>粘贴剪贴板</button>
            {detected?.mode === 'collect' && <span className="rounded-full bg-terra-wash px-2.5 py-1 text-terra">已识别：{PLATFORM_LABELS[detected.platform]}链接</span>}
            {detected?.mode === 'article-url' && <span className="rounded-full bg-terra-wash px-2.5 py-1 text-terra">已识别：公开文章链接</span>}
            {detected?.mode === 'text' && <span className="rounded-full bg-terra-wash px-2.5 py-1 text-terra">已识别：文字原文</span>}
          </div>
          <button type="button" onClick={() => void submit()} disabled={busy || !input.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-4 py-2 text-sm font-semibold text-white transition hover:bg-terra-deep disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <><LoaderCircle size={16} className="animate-spin"/>正在接入…</> : <><Sparkles size={16}/>收下并拆分</>}
          </button>
        </div>
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer select-none">补充标题（可选）</summary>
          <input aria-label="快速入库标题" value={title} onChange={event => setTitle(event.target.value)} maxLength={180} placeholder="不填时自动取正文第一句" className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terra" />
        </details>
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
        {receipt && <div role="status" className={`mt-3 flex items-start justify-between gap-3 rounded-xl border px-3 py-3 text-xs leading-5 ${receipt.status === 'failed' ? 'border-red-200 bg-red-50 text-red-800' : receipt.status === 'completed' ? 'border-terra/20 bg-terra-wash text-terra-deep' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <span className="flex min-w-0 items-start gap-2">
            {receipt.status === 'working' ? <LoaderCircle size={16} className="mt-0.5 flex-none animate-spin"/> : receipt.status === 'completed' ? <CheckCircle2 size={16} className="mt-0.5 flex-none"/> : <Clock3 size={16} className="mt-0.5 flex-none"/>}
            <span><b className="block truncate text-sm">{receipt.label}</b><span>{receipt.detail}</span><span className="mt-1 flex gap-3"><Link href={receipt.sourceId ? `/resources?source=${encodeURIComponent(receipt.sourceId)}` : '/resources'} className="underline">查看原始资料</Link>{receipt.status === 'completed' && <Link href="/resources?review=pending" className="underline">检查知识块</Link>}</span></span>
          </span>
          <button type="button" aria-label="关闭最近任务提示" onClick={() => { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); setReceipt(null); rememberReceipt(null); }} className="grid h-7 w-7 flex-none place-items-center rounded-full hover:bg-black/5"><X size={14}/></button>
        </div>}
      </div>
    </div>
  </section>;
}
