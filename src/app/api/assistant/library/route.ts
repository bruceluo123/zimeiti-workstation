import { NextResponse } from 'next/server';
import { assistantAllowed, startWorker } from '@/lib/assistant/server';
import { updateState } from '../../../../../scripts/assistant/store.mjs';
import { queueLibraryExtractionWithOptions } from '../../../../../scripts/assistant/library.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!assistantAllowed(request)) return NextResponse.json({ error: '请在本机工作站提炼素材' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length')) > 2500000) throw new Error('本批资料过大，请减少选择');
    const raw = await request.text();
    if (raw.length > 1000000) throw new Error('本批资料过大，请减少选择');
    const body = JSON.parse(raw);
    const result = await updateState(state => queueLibraryExtractionWithOptions(state, body.sources, body.model, { message: body.message, force: body.force === true }));
    if (result.jobId) {
      try { await startWorker(); }
      catch {
        await updateState(state => {
          const job = state.jobs.find(item => item.id === result.jobId);
          if (job?.status === 'queued') { job.status = 'failed'; job.error = '提炼进程启动失败，资料已保存，请重试'; }
        });
        throw new Error('提炼进程启动失败，资料已保存，请重试');
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '提炼启动失败' }, { status: 400 });
  }
}
