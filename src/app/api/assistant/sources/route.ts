import { NextResponse } from 'next/server';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { assistantAllowed, extractPdf } from '@/lib/assistant/server';
import { addSource, updateState, dataRoot, uid } from '../../../../../scripts/assistant/store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!assistantAllowed(request)) return NextResponse.json({ error: '仅限本机工作站导入资料' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length')) > 22000000) throw new Error('每次最多上传 20 MB');
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') || (file instanceof File ? file.name : '粘贴的资料')).slice(0, 180);
    const url = String(form.get('url') || '').trim();
    if (url && !/^https?:\/\//i.test(url)) throw new Error('出处链接须为 http 或 https');
    if (url.length > 2000) throw new Error('链接过长');
    const librarySourceId = String(form.get('librarySourceId') || '');
    if (librarySourceId && !/^[a-zA-Z0-9_-]{1,100}$/.test(librarySourceId)) throw new Error('素材标识无效');
    const author = String(form.get('author') || '').slice(0, 200);
    let text = String(form.get('text') || '');
    let pages: { locator: string; text: string }[] | undefined;
    let warning = '';
    let kind = 'text';
    if (file instanceof File) {
      if (file.size > 20000000) throw new Error('单文件最多 20 MB');
      const ext = path.extname(file.name).toLowerCase();
      if (ext === '.pdf') {
        kind = 'pdf';
        const dir = path.join(dataRoot(), 'uploads'); await mkdir(dir, { recursive: true });
        const temp = path.join(dir, uid() + '.pdf');
        try {
          const bytes = Buffer.from(await file.arrayBuffer());
          if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('文件不是有效 PDF');
          await writeFile(temp, bytes, { flag: 'wx' });
          const extracted = await extractPdf(temp); pages = extracted.pages;
          if (extracted.emptyPages.length) warning = `有 ${extracted.emptyPages.length} 页未提取到文字（可能为图片/空白页），本次不会分析这些页。`;
        } finally { await unlink(temp).catch(() => {}); }
      } else if (['.txt','.md','.srt','.vtt'].includes(ext)) {
        text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      } else throw new Error('本版支持 PDF、TXT、Markdown、SRT、VTT。视频请先转写字幕再导入。');
    }
    if (!pages && (!text.trim() || text.length > 2000000)) throw new Error('请输入正文（最多 200 万字），只有链接时请先到来源资源库采集');
    const source = await updateState(state => {
      const item = addSource(state, { title, text, pages, url, kind });
      if (librarySourceId) item.librarySourceIds = Array.from(new Set([...(item.librarySourceIds || []), librarySourceId]));
      if (author && !item.author) item.author = author;
      return item;
    });
    return NextResponse.json({ id: source.id, title: source.title, chunks: source.chunks.length, warning });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '导入失败' }, { status: 400 }); }
}
