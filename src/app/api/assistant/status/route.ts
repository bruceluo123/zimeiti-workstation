import { NextResponse } from 'next/server';
import path from 'node:path';
import { assistantAllowed } from '@/lib/assistant/server';
import { connectCodex } from '../../../../../scripts/assistant/codex.mjs';
import { dataRoot } from '../../../../../scripts/assistant/store.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!assistantAllowed(request)) return NextResponse.json({ error: '本机 Codex 仅支持本机工作站访问' }, { status: 403 });
  try {
    const client = await connectCodex(path.join(dataRoot(), 'codex-sandbox'));
    try { return NextResponse.json({ connected: true, models: client.models.map((item: { model: string; isDefault: boolean }) => ({ id: item.model, isDefault: item.isDefault })) }, { headers: { 'Cache-Control': 'no-store' } }); }
    finally { client.close(); }
  } catch (error) { return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : '连接失败' }, { status: 503 }); }
}
