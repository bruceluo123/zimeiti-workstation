import { NextResponse } from 'next/server';
import path from 'node:path';
import { assistantAllowed } from '@/lib/assistant/server';
import { dataRoot } from '../../../../../scripts/assistant/store.mjs';
import { searchWeb } from '../../../../../scripts/assistant/web-search.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 130;

export async function POST(request: Request) {
  const response = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!assistantAllowed(request)) return response({ error: 'AI 快搜仅支持本机工作站。' }, 403);
  try {
    if (Number(request.headers.get('content-length')) > 20000) throw new Error('搜索问题过长，请精简后重试。');
    const raw = await request.text();
    if (raw.length > 20000) throw new Error('搜索问题过长，请精简后重试。');
    const input = JSON.parse(raw);
    const result = await searchWeb({ cwd: path.join(dataRoot(), 'codex-sandbox'), question: input.question, context: input.context || '', previous: input.previous || null, model: input.model || 'gpt-5.6-luna', signal: request.signal });
    return response(result);
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : '联网搜索失败' }, 400);
  }
}
