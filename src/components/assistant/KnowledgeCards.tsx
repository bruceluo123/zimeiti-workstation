'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { KnowledgeDraft } from '@/types/writing';
import { BLOCK_KINDS, BUNDLE_ROLE_LABELS, BUNDLE_TYPE_LABELS, type AssistantSource, type KnowledgeBlock } from '@/types/assistant';
import { assistantRequest } from './client';

export function KnowledgeCard({ block, sources, onChange }: { block: KnowledgeBlock; sources: AssistantSource[]; onChange?: () => Promise<void> }) {
  const [body, setBody] = useState(block.body);
  const [kind, setKind] = useState(block.kind);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [original, setOriginal] = useState('');
  const [usage, setUsage] = useState<{ id: string; title: string; active: boolean; modified: boolean; publications: KnowledgeDraft['publications'] }[] | null>(null);
  useEffect(() => { setBody(block.body); setKind(block.kind); }, [block.body, block.kind]);
  async function showUsage() {
    if (usage) { setUsage(null); return; }
    try { setUsage(await assistantRequest(`/writing?usage=${encodeURIComponent(block.id)}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : '使用记录读取失败'); }
  }
  const source = sources.find(item => item.id === block.sourceId);
  const pending = block.status === 'pending';
  async function review(status: 'approved' | 'rejected') {
    setBusy(true); setMessage('');
    try { await assistantRequest('', { action: 'review', id: block.id, status, text: body, kind }); await onChange?.(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败'); }
    finally { setBusy(false); }
  }
  async function viewOriginal() {
    if (original) { setOriginal(''); return; }
    try {
      const data = await assistantRequest(`?source=${encodeURIComponent(block.sourceId)}`);
      const chunk = data.chunks.find((item: { id: string }) => item.id === block.chunkId);
      setOriginal(chunk?.text || '对应原文段落不存在');
    } catch (error) { setMessage(error instanceof Error ? error.message : '读取失败'); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${body}\n\n来源：${source?.author ? `${source.author} · ` : ''}${source?.title || '原始资料'} · ${block.locator}${source?.url ? `\n${source.url}` : ''}\n注意：${block.verification}`); setMessage('已复制（含出处）'); }
    catch { setMessage('复制失败，请手动选中文字复制'); }
  }
  return <article className="rounded-2xl border border-line bg-white p-4">
    {block.bundleTitle && <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3"><span className="text-[11px] font-semibold tracking-wide text-terra">{block.bundleTitle}</span>{block.bundleType && <span className="rounded-full bg-terra-wash px-2 py-1 text-[10px] text-terra">{BUNDLE_TYPE_LABELS[block.bundleType]}</span>}{block.bundleRole && <span className="rounded-full bg-[#f3eee5] px-2 py-1 text-[10px] text-[#7a5a31]">{BUNDLE_ROLE_LABELS[block.bundleRole]}</span>}</div>}
    <div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-6">{source?.title || '原始资料'}</h3><span className="shrink-0 rounded-full bg-terra-wash px-2 py-1 text-xs text-terra">{block.kind}</span></div>
    {pending ? <><label className="mt-3 block text-xs text-muted">原文原句（可从同一原文段落中重新选取）<textarea aria-label={`修改原句：${block.title}`} value={body} onChange={event => setBody(event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-line p-3 text-sm leading-7 text-ink" /></label><label className="mt-2 flex items-center gap-2 text-xs">归入<select aria-label="知识块分类" value={kind} onChange={event => setKind(event.target.value)} className="rounded-lg border border-line p-2">{BLOCK_KINDS.map(item => <option key={item}>{item}</option>)}</select></label></> : <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-terra/30 bg-surface-2 p-3 text-sm leading-7 text-ink">{body}</blockquote>}
    <p className="mt-2 text-xs text-muted">{source?.author ? `${source.author} · ` : ''}{source?.title} · {block.locator}</p><p className="mt-1 text-xs text-amber-700">{pending ? '待确认' : '已入库'} · 来源说法，未经独立核验 · AI：{block.model}</p>
    {source?.librarySourceIds?.[0] && <Link href={`/resources?source=${encodeURIComponent(source.librarySourceIds[0])}`} className="mt-2 inline-block text-xs text-terra">回到来源素材 →</Link>}
    <div className="mt-3 flex flex-wrap gap-2 text-xs"><button onClick={viewOriginal} className="rounded-lg border border-line px-3 py-2">{original ? '收起原文' : '查看原文段落'}</button><button onClick={copy} className="rounded-lg border border-line px-3 py-2">复制含出处</button>{pending && <><button disabled={busy} onClick={() => review('approved')} className="rounded-lg bg-terra px-3 py-2 text-white disabled:opacity-50">确认入库</button><button disabled={busy} onClick={() => review('rejected')} className="rounded-lg border border-line px-3 py-2">不收录</button></>}</div>
    {original && <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-xs leading-6">{original}</pre>}
    {!pending && <button onClick={showUsage} className="mt-3 rounded-lg border border-line px-3 py-2 text-xs text-terra">{usage ? '收起使用记录' : '用在哪些稿子？'}</button>}
    {usage && <div className="mt-3 rounded-xl bg-terra-wash p-3 text-xs leading-6"><p className="font-semibold">当前用于 {usage.filter(item => item.active).length} 篇草稿 · {usage.filter(item => item.publications.length).length} 篇标记发布</p>{!usage.length && <p>尚未使用。去“边查边写”寻找适合它的观点。</p>}{usage.map(item => <div key={item.id} className="mt-2 border-t border-terra/10 pt-2"><Link href={`/write?draft=${encodeURIComponent(item.id)}`} className="font-medium text-terra">{item.title} ↗</Link><p>{item.active ? '正文使用中' : item.modified ? '正文已修改，待复核' : '仅备忘或已移除'}{item.publications.length ? ` · ${item.publications.length} 条发布记录` : ''}</p></div>)}</div>}
    {message && <p role="status" className="mt-2 text-xs text-terra">{message}</p>}
  </article>;
}
