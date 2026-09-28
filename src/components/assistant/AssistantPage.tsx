'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, FilePlus2, Send, Sparkles, Plus, RefreshCw } from 'lucide-react';
import type { AssistantState } from '@/types/assistant';
import { assistantRequest } from './client';
import { KnowledgeCard } from './KnowledgeCards';

const field = 'w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-terra';
const small = 'rounded-lg border border-line bg-white px-3 py-2 text-xs hover:border-terra disabled:opacity-50';
export function AssistantPage() {
  const [state, setState] = useState<AssistantState | null>(null);
  const [conversationId, setConversationId] = useState('');
  const [models, setModels] = useState<{ id: string; isDefault: boolean }[]>([]);
  const [model, setModel] = useState('');
  const [connection, setConnection] = useState('正在检查本机 Codex…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const profileLoaded = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'chat' | 'extract'>('chat');
  const [material, setMaterial] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [sourceFocus, setSourceFocus] = useState<'list' | 'paste' | null>(null);
  const [composerFocus, setComposerFocus] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'sources' | 'review'>('chat');
  const upload = useRef<HTMLInputElement>(null);
  const sourceList = useRef<HTMLElement>(null);
  const materialInput = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    const next: AssistantState = await assistantRequest(); setState(next);
    setConversationId(current => current || next.conversations[0]?.id || '');
    if (!profileLoaded.current) { setProfile(next.profile); profileLoaded.current = true; }
  }, []);
  const connect = useCallback(async () => {
    setConnection('正在检查本机 Codex…');
    try { const next = await assistantRequest('/status'); setModels(next.models); setModel(current => current || next.models.find((item: { isDefault: boolean }) => item.isDefault)?.id || next.models[0]?.id); setConnection('本机 Codex 已连接'); await assistantRequest('', { action: 'wake' }); await refresh(); }
    catch (cause) { setConnection(cause instanceof Error ? cause.message : '未连接'); setModels([]); }
  }, [refresh]);
  useEffect(() => {
    refresh().catch(cause => setError(cause.message)); void connect();
    const source = new URLSearchParams(window.location.search).get('source');
    if (source) { setSelected([source]); setMode('extract'); setMessage('请结合我的创作方向，从这份资料挑选值得保存的原文原句，按观点、事实论据、案例或方法分类，保留出处，指出需要核实的说法。不要将 AI 改写或总结收入知识积木。'); }
  }, [refresh, connect]);
  const active = state?.jobs.some(job => ['queued','running'].includes(job.status));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { refresh().catch(cause => setError(cause.message)); }, 2000);
    return () => window.clearInterval(timer);
  }, [active, refresh]);
  const conversation = state?.conversations.find(item => item.id === conversationId);
  const pending = state?.blocks.filter(block => block.status === 'pending' && block.conversationId === conversationId) || [];
  const jobs = state?.jobs.filter(job => job.conversationId === conversationId).slice(-3) || [];
  const selectedSources = state?.sources.filter(source => selected.includes(source.id)) || [];
  const sourceCount = selectedSources.length;
  const chunkCount = selectedSources.reduce((sum, source) => sum + source.chunkCount, 0);
  const needsSource = mode === 'extract' && sourceCount === 0;
  const sendDisabled = Boolean(busy || active || !model || !message.trim() || needsSource || sourceCount > 10);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [conversation?.messages.length]);
  useEffect(() => {
    if (!sourceFocus) return;
    const target = sourceFocus === 'paste' ? materialInput.current : sourceList.current;
    target?.scrollIntoView({ block: 'center' });
    target?.focus({ preventScroll: true });
    setSourceFocus(null);
  }, [sourceFocus]);
  useEffect(() => {
    if (!composerFocus) return;
    composer.current?.scrollIntoView({ block: 'center' });
    composer.current?.focus({ preventScroll: true });
    setComposerFocus(false);
  }, [composerFocus]);

  function openSources(target: 'list' | 'paste') {
    setMobilePanel('sources');
    if (target === 'paste') setPasteOpen(true);
    setSourceFocus(target);
  }
  function returnToComposer() {
    setMobilePanel('chat');
    setComposerFocus(true);
  }
  async function showOperationError(cause: unknown, fallback: string) {
    const failure = cause instanceof Error ? cause.message : fallback;
    setError(failure);
    // A request can fail after the server has saved a failed job (for example, worker startup).
    try { await refresh(); }
    catch { setError(`${failure}；任务状态刷新失败，请重新检查连接。`); }
  }

  async function mutate(body: unknown) {
    setError(''); setBusy(true);
    try { const result = await assistantRequest('', body); await refresh(); return result; }
    catch (cause) { await showOperationError(cause, '操作失败'); }
    finally { setBusy(false); }
  }
  async function newConversation() {
    const item = await mutate({ action: 'conversation' }); if (item) { setConversationId(item.id); setSelected([]); }
  }
  async function send() {
    if (sendDisabled) return;
    setBusy(true); setError('');
    try {
      let id = conversationId;
      if (!id) { id = (await assistantRequest('', { action: 'conversation' })).id; setConversationId(id); }
      await assistantRequest('', { action: 'send', conversationId: id, message, mode, model, sourceIds: selectedSources.map(source => source.id) });
      setMessage(''); await refresh();
    } catch (cause) { await showOperationError(cause, '发送失败'); }
    finally { setBusy(false); }
  }
  async function importSources(files?: File[]) {
    if (busy || (files && !files.length) || (!files && !material.trim())) return;
    if (files && files.length > 10) { setError('每次最多选择 10 个文件'); return; }
    setBusy(true); setError(''); setImportNotice('');
    const ids: string[] = []; const warnings: string[] = [];
    try {
      for (const file of files || [null]) {
        const form = new FormData();
        if (file) form.set('file', file); else { form.set('text', material); form.set('title', title || '粘贴的资料'); form.set('url', url); }
        const response = await fetch('/api/assistant/sources', { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(`${file?.name || '资料'}：${result.error}`);
        ids.push(result.id); if (result.warning) warnings.push(result.warning);
      }
      if (!files) { setMaterial(''); setTitle(''); setUrl(''); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败'); }
    finally {
      setSelected(current => Array.from(new Set([...current, ...ids])));
      if (ids.length) { setMode('extract'); setImportNotice(`已保存/复用 ${ids.length} 份参考资料并勾选。填写提炼要求后点击发送；资料内容仍需核实。${warnings.join(' ')}`); }
      await refresh().catch(cause => setError(cause.message)); setBusy(false);
      if (ids.length) returnToComposer();
      if (upload.current) upload.current.value = '';
    }
  }

  return <div className="mx-auto max-w-[1640px] px-4 py-6 lg:px-7">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[2px] text-terra">CODEX · 本机连接</p><h1 className="mt-1 text-3xl font-semibold">AI 工作台</h1><p className="mt-2 text-sm text-muted">带着你的创作背景，一起把资料变成可复用的知识。</p></div><Link href="/resources" className={small}>打开资源库 →</Link></header>
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-terra/20 bg-terra-wash px-4 py-3 text-xs text-terra-deep"><Bot size={17}/><span>{connection}</span><button onClick={connect} aria-label="重新检查 Codex 连接"><RefreshCw size={14}/></button><span className="ml-auto">沿用本机登录与额度 · 不使用 DeepSeek API</span></div>
    {error && <p role="alert" className="sticky top-3 z-10 mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm">{error}</p>}
    <nav aria-label="AI 工作台面板" className="mb-3 flex gap-2 xl:hidden">{([['chat','对话'],['sources','资料与记忆'],['review',`待确认 ${pending.length}`]] as const).map(([key,label]) => <button key={key} onClick={() => setMobilePanel(key)} className={`${small} ${mobilePanel === key ? 'border-terra text-terra' : ''}`}>{label}</button>)}</nav>
    <div className="grid items-start gap-4 xl:grid-cols-[260px_minmax(320px,1fr)_330px]">
      <aside className={`${mobilePanel === 'sources' ? 'block' : 'hidden'} space-y-4 xl:block`}>
        <section className="rounded-2xl border border-line bg-white p-4"><div className="flex justify-between"><h2 className="text-sm font-semibold">我的对话</h2><button disabled={busy} onClick={newConversation} aria-label="新建对话"><Plus size={17}/></button></div><div className="mt-3 max-h-40 space-y-1 overflow-auto">{state?.conversations.map(item => <button key={item.id} onClick={() => { setConversationId(item.id); setSelected([]); setMobilePanel('chat'); }} className={`block w-full truncate rounded-lg px-2 py-2 text-left text-xs ${item.id === conversationId ? 'bg-terra-wash text-terra' : 'hover:bg-surface-2'}`}>{item.title}</button>)}</div></section>
        <details className="rounded-2xl border border-line bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">创作档案 · 长期记忆</summary><p className="my-2 text-xs leading-5 text-muted">你确认的创作偏好会用于每次新请求。不会读取其他 Codex/ChatGPT 聊天。</p><textarea aria-label="创作档案" value={profile} maxLength={8000} onChange={event => { setProfile(event.target.value); setProfileNotice(''); }} className={`${field} min-h-44`}/><button disabled={busy} onClick={async () => { if (await mutate({ action: 'profile', text: profile })) setProfileNotice('已保存，下次请求生效'); }} className={`${small} mt-2`}>保存创作档案</button>{profileNotice && <p role="status" className="mt-2 text-xs text-terra">{profileNotice}</p>}</details>
        <section ref={sourceList} tabIndex={-1} aria-label="本次参考资料" className="rounded-2xl border border-line bg-white p-4 outline-none focus:ring-2 focus:ring-terra/40">
          <h2 className="text-sm font-semibold">本次参考资料</h2>
          <p className="mt-2 text-xs leading-5 text-muted">勾选需要提炼的资料，最多 10 份。只有勾选的资料会发送给 Codex。已入库知识按关键词检索；不自动上传旧知识库。</p>
          <div className="my-3 max-h-60 space-y-3 overflow-auto">
            {!state?.sources.length && <p className="rounded-lg bg-surface-2 p-3 text-xs leading-5 text-muted">还没有参考资料。请上传文件，或在下方粘贴原文并保存。</p>}
            {state?.sources.map(source => <label key={source.id} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={selected.includes(source.id)} onChange={event => setSelected(current => event.target.checked ? [...current,source.id] : current.filter(id => id !== source.id))}/><span>{source.title}<small className="mt-1 block text-muted">{source.characters.toLocaleString()} 字 · {source.chunkCount} 段</small><small className="mt-1 block break-all text-muted">{source.url ? `出处：${source.url}` : '未提供出处链接 · 请核对原始来源'}</small></span></label>)}
          </div>
          {sourceCount > 10 && <p role="alert" className="mb-2 text-xs text-red-700">每次最多分析 10 份资料，请取消部分勾选。</p>}
          <button disabled={!sourceCount || sourceCount > 10 || busy} onClick={returnToComposer} className={`${small} mb-3 w-full border-terra text-terra`}>使用已选 {sourceCount} 份资料，返回对话</button>
          <input ref={upload} type="file" multiple accept=".pdf,.txt,.md,.srt,.vtt" className="hidden" onChange={event => importSources(Array.from(event.target.files || []))}/>
          <button disabled={busy} onClick={() => upload.current?.click()} className={`${small} flex w-full items-center justify-center gap-2`}><FilePlus2 size={15}/>上传 PDF / 文本</button>
          <p className="mt-2 text-[11px] leading-5 text-muted">单份最多 20 MB；支持多选。扫描件需先 OCR，视频请上传转写字幕。文件先在本机解析。</p>
          <details open={pasteOpen} onToggle={event => setPasteOpen(event.currentTarget.open)} className="mt-3">
            <summary className="cursor-pointer text-xs text-terra">或粘贴长文 / 字幕</summary>
            <p id="paste-source-help" className="mt-2 text-xs leading-5 text-muted">正文将保存到本机参考资料，并自动勾选。请填写便于追溯的标题和出处链接；没有链接时请在正文注明作者、书名或来源。保存与提炼均不代表事实已核验。</p>
            <div className="mt-2 space-y-2"><input aria-label="资料标题" placeholder="资料标题" value={title} onChange={event => setTitle(event.target.value)} className={field}/><input aria-label="资料出处链接" placeholder="出处链接（可选，不自动抓取）" value={url} onChange={event => setUrl(event.target.value)} className={field}/><textarea ref={materialInput} aria-label="资料正文" aria-describedby="paste-source-help" placeholder="粘贴正文，书籍按段分析，不截断冒充全文" value={material} onChange={event => setMaterial(event.target.value)} className={`${field} min-h-36`}/><button disabled={busy || !material.trim()} onClick={() => importSources()} className={small}>{busy ? '正在保存…' : '保存为参考资料并选中'}</button></div>
          </details>
        </section>
      </aside>
      <section className={`${mobilePanel === 'chat' ? 'flex' : 'hidden'} min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-white xl:flex`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{conversation?.title || '从一个想法开始'}</h2><select aria-label="Codex 模型" value={model} onChange={event => setModel(event.target.value)} className="max-w-40 rounded-lg bg-surface-2 p-2 text-xs"><option value="" disabled>选择模型</option>{models.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}</select></div>
        <div className="min-h-[320px] max-h-[56vh] space-y-5 overflow-auto p-4 lg:p-6">
          {!conversation?.messages.length && <div className="py-12"><Sparkles className="mb-4 text-terra"/><h3 className="text-xl font-semibold">不止收藏，聊出可以用的东西。</h3><p className="mt-3 text-sm leading-7 text-muted">先上传或粘贴资料，再告诉我你想写什么、需要什么论据。我的概括和原文会分开，提炼结果由你确认。</p><button onClick={() => setMessage('请帮我梳理这个选题：我想表达什么、还缺哪些事实和案例？')} className={`${small} mt-5`}>先讨论一个选题</button></div>}
          {conversation?.messages.map(item => <article key={item.id} className={item.role === 'user' ? 'ml-6 rounded-2xl bg-terra-wash p-4' : 'rounded-xl border-b border-line pb-5'}><p className="mb-2 text-[11px] font-semibold text-terra">{item.role === 'user' ? '你' : `Codex${item.part ? ` · 分段 ${item.part}` : ''}`}</p><p className="whitespace-pre-wrap break-words text-sm leading-7">{item.text}</p></article>)}<div ref={end}/>
        </div>
        {jobs.map(job => <div key={job.id} className={`mx-4 mb-3 rounded-xl p-3 text-xs ${job.status === 'failed' ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-surface-2'}`}><p role={job.status === 'failed' ? 'alert' : 'status'}>{job.status === 'failed' ? `提炼或对话失败：${job.error || '未返回错误详情，请重新检查 Codex 连接后重试。'}` : job.status === 'cancelled' ? '已取消，已完成的分段仍然保留' : job.progress || (job.status === 'completed' ? '任务已完成，请查看结果和待确认的知识块' : job.status === 'running' ? 'Codex 正在分析资料…' : '已排队，等待 Codex')}</p>{job.context && <p className="mt-1 text-muted">本次上下文：创作档案 · 最近 {job.context.historyCount} 条消息 · {job.context.relatedIds.length} 个相关知识块</p>}{['queued','running'].includes(job.status) && <button disabled={busy} onClick={() => mutate({ action: 'cancel', id: job.id })} className={`${small} mt-2`}>停止本次任务</button>}{['failed','cancelled'].includes(job.status) && <button disabled={busy || active} onClick={() => mutate({ action: 'retry', id: job.id })} className={`${small} mt-2`}>从断点重试</button>}</div>)}
        <div className="border-t border-line p-4">
          <div className="mb-2 flex gap-2">{([['chat','创作对话'],['extract','提炼入库']] as const).map(([key,label]) => <button key={key} onClick={() => setMode(key)} className={`${small} ${mode === key ? 'border-terra bg-terra-wash text-terra' : ''}`}>{label}</button>)}</div>
          {mode === 'extract' && <div className={`mb-3 rounded-xl border p-3 ${needsSource ? 'border-amber-300 bg-amber-50' : 'border-line bg-surface-2'}`}>
            <p id="extract-source-help" role="status" className="text-sm font-medium">{needsSource ? '还没有选择资料，暂时无法提炼入库。' : `已选 ${sourceCount} 份资料，可填写要求后发送。`}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{needsSource ? '先上传、粘贴原文或勾选已有资料；下方输入框用于填写提炼要求。' : '提炼结果保留原文出处，由你检查后确认入库。'}</p>
            <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => upload.current?.click()} className={small}>上传资料</button><button disabled={busy} onClick={() => openSources('paste')} className={small}>粘贴原文</button><button disabled={busy} onClick={() => openSources('list')} className={small}>选择已有资料</button></div>
          </div>}
          {importNotice && <p role="status" className="mb-3 rounded-lg bg-terra-wash p-3 text-xs leading-5 text-terra">{importNotice}</p>}
          <textarea ref={composer} aria-label="给 Codex 的要求" aria-describedby={mode === 'extract' ? 'extract-source-help' : undefined} value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void send(); } }} placeholder={mode === 'extract' ? '例如：找出支持“长期积累比频繁换工具更重要”的观点、案例和反例，保留出处。' : '我想写一条推特，观点是……请结合库里相关的知识帮我讨论。'} className={`${field} min-h-28`}/>
          {sourceCount > 10 && <p role="alert" className="mt-2 text-xs text-red-700">每次最多分析 10 份资料，请打开“选择已有资料”取消部分勾选。</p>}
          {!model && <p className="mt-2 text-xs text-muted">连接 Codex 并选择模型后才能发送，可在页面顶部重新检查连接。</p>}
          <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] leading-5 text-muted">已选 {sourceCount} 份 · {chunkCount} 段<br/>{mode === 'extract' ? sourceCount ? `预计 ${Math.max(1,Math.ceil(chunkCount/4))} 次分析，占用 Codex 额度` : '添加资料后显示分析次数' : 'Ctrl/⌘ + Enter 发送'}</span><button disabled={sendDisabled} onClick={send} className="flex items-center gap-2 rounded-xl bg-terra px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"><Send size={15}/>{active ? '处理中' : busy ? '请稍候…' : '发送'}</button></div>
        </div>
      </section>
      <aside className={`${mobilePanel === 'review' ? 'block' : 'hidden'} space-y-3 xl:block`}><div className="rounded-xl bg-[#173f35] p-4 text-white"><h2 className="font-semibold">待确认的知识块 <span className="opacity-60">{pending.length}</span></h2><p className="mt-2 text-xs leading-6 text-white/70">先检查原文，再选择收录。事实论据、观点、方法各归其位；入库不代表事实已核验。</p></div>{!pending.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">提炼完成后，候选知识块会出现在这里。</p>}{pending.map(block => <KnowledgeCard key={block.id} block={block} sources={state?.sources || []} onChange={refresh}/>)}</aside>
    </div>
    <p className="mt-4 text-xs leading-6 text-muted">方式 B：此电脑保持开机并运行工作站即可继续任务；关闭浏览器不会中断。工作站保存自己的会话和知识，不继承其他聊天。本版仅供本机使用，线上与手机远程连接尚未开放。</p>
  </div>;
}
