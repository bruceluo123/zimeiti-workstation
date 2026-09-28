import { NextResponse } from 'next/server';
import { assistantAllowed, startWorker } from '@/lib/assistant/server';
import { readState, updateState, publicState, uid, now, reviewQuotedBlock } from '../../../../scripts/assistant/store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const deny = () => NextResponse.json({ error: '方式 B 仅在本机工作站可用。请用此电脑打开 http://127.0.0.1:3002/assistant。' }, { status: 403 });

export async function GET(request: Request) {
  if (!assistantAllowed(request)) return deny();
  try {
    const state = await readState();
    const sourceId = new URL(request.url).searchParams.get('source');
    if (sourceId) {
      const source = state.sources.find((item: { id: string }) => item.id === sourceId);
      return source ? NextResponse.json(source, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ error: '来源不存在' }, { status: 404 });
    }
    return NextResponse.json(publicState(state), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '读取失败' }, { status: 500 }); }
}

export async function POST(request: Request) {
  if (!assistantAllowed(request)) return deny();
  try {
    if (Number(request.headers.get('content-length')) > 80000) throw new Error('请求过大');
    const raw = await request.text();
    if (raw.length > 80000) throw new Error('请求过大');
    const body = JSON.parse(raw);
    let run = false;
    let jobId = '';
    const result = await updateState(state => {
      if (body.action === 'wake') { run = true; return { ok: true }; }
      if (body.action === 'profile') {
        if (typeof body.text !== 'string' || body.text.length > 8000) throw new Error('创作档案最多 8000 字');
        state.profile = body.text; return { ok: true };
      }
      if (body.action === 'conversation') {
        const item = { id: uid(), title: '新的创作对话', messages: [], createdAt: now() };
        state.conversations.unshift(item); return { id: item.id };
      }
      if (body.action === 'send') {
        const thread = state.conversations.find((item: { id: string }) => item.id === body.conversationId);
        if (!thread) throw new Error('请先新建对话');
        if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 12000) throw new Error('请输入 1—12000 字的要求；长文请作为资料导入');
        if (!['chat', 'extract'].includes(body.mode)) throw new Error('无效模式');
        if (!Array.isArray(body.sourceIds) || body.sourceIds.length > 10 || body.sourceIds.some((id: unknown) => typeof id !== 'string' || !state.sources.some((item: { id: string }) => item.id === id))) throw new Error('请选择最多 10 份有效来源');
        if (body.mode === 'extract' && !body.sourceIds.length) throw new Error('请先导入并勾选资料');
        if (typeof body.model !== 'string' || !/^[a-z0-9.-]{1,80}$/.test(body.model)) throw new Error('请选择已连接的 Codex 模型');
        if (state.jobs.some((job: { status: string }) => ['queued','running'].includes(job.status))) throw new Error('当前有任务进行中，请完成或取消后再发起，避免重复占用额度');
        const id = uid();
        jobId = id;
        thread.title = thread.messages.length ? thread.title : body.message.trim().slice(0, 28);
        thread.messages.push({ id: uid(), role: 'user', text: body.message.trim(), jobId: id, createdAt: now() });
        state.jobs.push({ id, conversationId: thread.id, message: body.message.trim(), mode: body.mode, model: body.model, sourceIds: Array.from(new Set(body.sourceIds as string[])), profile: state.profile, status: 'queued', runVersion: uid(), completed: 0, createdAt: now(), updatedAt: now() });
        run = true; return { id };
      }
      if (body.action === 'cancel' || body.action === 'retry') {
        const job = state.jobs.find((item: { id: string }) => item.id === body.id);
        if (!job) throw new Error('任务不存在');
        if (body.action === 'cancel') { if (!['running','queued'].includes(job.status)) throw new Error('任务已经结束'); job.status = 'cancelled'; }
        else {
          if (!['failed','cancelled'].includes(job.status)) throw new Error('任务尚未失败或取消');
          if (state.jobs.some((item: { status: string }) => ['queued','running'].includes(item.status))) throw new Error('请先等待当前任务结束');
          job.status = 'queued'; job.runVersion = uid(); job.error = ''; jobId = job.id; run = true;
        }
        job.updatedAt = now(); return { ok: true };
      }
      if (body.action === 'review') {
        reviewQuotedBlock(state, body.id, body.status, body.text, body.kind); return { ok: true };
      }
      throw new Error('未知操作');
    });
    if (run) {
      try { await startWorker(); }
      catch {
        if (jobId) await updateState(state => { const job = state.jobs.find(item => item.id === jobId); if (job?.status === 'queued') { job.status = 'failed'; job.error = '本机任务进程启动失败，请重试。原始资料已保存。'; } });
        throw new Error('本机任务进程启动失败，请重试。原始资料已保存。');
      }
    }
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '操作失败' }, { status: 400 }); }
}
