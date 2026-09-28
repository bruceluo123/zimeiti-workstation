import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { GUIDE_URL, parseGuide } from './assistant/book-guide.mjs';

const chapter = process.argv.includes('--chapter') ? Number(process.argv[process.argv.indexOf('--chapter') + 1]) : null;
if (chapter !== null && (!Number.isInteger(chapter) || chapter < 1 || chapter > 33)) throw new Error('章节编号须为 1—33。');
const response = await fetch(GUIDE_URL, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'ZMT-personal-source-library/1.0' } });
if (!response.ok) throw new Error(`书籍网页读取失败：HTTP ${response.status}`);
const raw = await response.arrayBuffer();
if (raw.byteLength > 3_000_000) throw new Error('网页超过 3 MB，已停止导入。');
const { chapterCount, sources: all } = parseGuide(new TextDecoder('utf-8', { fatal: true }).decode(raw));
if (chapterCount !== 33 || all.length !== 608) throw new Error(`书籍结构与已检查版本不同（${chapterCount} 节、${all.length} 条），已停止导入，请重新核对网页。`);
const sources = chapter === null ? all : all.filter(source => source.book.chapterNumber === chapter);
if (chapter === 4 && sources.length !== 18) throw new Error('第 4 节不再是 18 条，已停止导入。');
const root = path.resolve(process.env.ZMT_SOURCE_DATA_DIR || path.join(os.homedir(), '.agent-reach', 'zmt-import'));
const library = path.join(root, 'library');
await mkdir(library, { recursive: true });
const result = { chapter: chapter ?? 'all', available: sources.length, created: 0, unchanged: 0, conflicts: 0 };
for (const source of sources) {
  const target = path.join(library, `${source.id}.json`);
  let existing;
  try { existing = JSON.parse(await readFile(target, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (existing.url === source.url && existing.body === source.body) result.unchanged++;
    else result.conflicts++;
    continue;
  }
  const temp = path.join(library, `${source.id}.${randomUUID()}.tmp`);
  try { await writeFile(temp, JSON.stringify(source), { flag: 'wx' }); await rename(temp, target); result.created++; }
  finally { await unlink(temp).catch(() => {}); }
}
console.log(JSON.stringify(result));
if (result.conflicts) process.exitCode = 2;
