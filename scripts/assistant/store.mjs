import { mkdir, readFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';

export const dataRoot = () => path.resolve(process.env.ZMT_KNOWLEDGE_DATA_DIR || path.join(os.homedir(), '.agent-reach', 'zmt-knowledge'));
export const now = () => new Date().toISOString();
export const uid = () => randomUUID();
export const hash = value => createHash('sha256').update(value).digest('hex');
export const initialState = () => ({ version: 1, profile: '创作方向：个人成长、AI 效率、自媒体实践。区分我的观点与他人观点。引用必须有出处，事实与未经核实的说法分开。优先提炼能用于写作的案例、事实论据、方法与反例。', conversations: [], sources: [], blocks: [], jobs: [] });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function readState() {
  try {
    const state = JSON.parse(await readFile(path.join(dataRoot(), 'state.json'), 'utf8'));
    if (state.version !== 1 || !['conversations', 'sources', 'blocks', 'jobs'].every(key => Array.isArray(state[key]))) throw new Error('invalid');
    if (state.writing !== undefined && (!Array.isArray(state.writing.drafts) || !Array.isArray(state.writing.events))) throw new Error('invalid writing state');
    normalizeQuotedBlocks(state);
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return initialState();
    throw new Error('知识库文件无法读取，已停止写入以保护原数据。请检查本机备份。');
  }
}

/** Cross-process lock; stale locks are removed only when their owner PID is gone. */
export async function acquireLock(name, waitMs = 8000) {
  await mkdir(dataRoot(), { recursive: true });
  const file = path.join(dataRoot(), name + '.lock');
  const started = Date.now();
  for (;;) {
    try {
      const handle = await open(file, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, token: uid() }));
      await handle.close();
      return async () => { await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; }); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(await readFile(file, 'utf8')); } catch {}
      if (owner?.pid) {
        try { process.kill(owner.pid, 0); }
        catch (cause) { if (cause.code === 'ESRCH') { await unlink(file).catch(() => {}); continue; } }
      }
      if (Date.now() - started >= waitMs) throw new Error('知识库正忙，请稍后重试。');
      await delay(80);
    }
  }
}

export async function updateState(change) {
  const release = await acquireLock('state');
  const tmp = path.join(dataRoot(), `state-${uid()}.tmp`);
  try {
    const state = await readState();
    const result = await change(state);
    // Write + flush + atomic replacement. A failed write never resets the database.
    const handle = await open(tmp, 'wx');
    try { await handle.writeFile(JSON.stringify(state)); await handle.sync(); } finally { await handle.close(); }
    const current = path.join(dataRoot(), 'state.json');
    try { await writeFile(path.join(dataRoot(), 'state.backup.json'), await readFile(current)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(tmp, current);
    return result;
  } finally { await unlink(tmp).catch(() => {}); await release(); }
}

export function addSource(state, { title, text, pages, url = '', kind = 'text' }) {
  const parts = pages || [{ locator: '正文', text }];
  if (!parts.some(item => item.text?.trim())) throw new Error('没有提取到文字。扫描 PDF 请先 OCR，视频请先转写字幕。');
  if (parts.reduce((total, item) => total + item.text.length, 0) > 2000000) throw new Error('单份资料最多 200 万字，请拆分导入。');
  // Same text from different cited URLs must not merge authorship/provenance.
  const fingerprint = hash(JSON.stringify({ url, parts: parts.map(item => item.text.trim()) }));
  const existing = state.sources.find(item => item.hash === fingerprint);
  if (existing) return existing;
  const chunks = [];
  for (const page of parts) {
    for (let offset = 0; offset < page.text.length; offset += 6000) {
      const body = page.text.slice(offset, offset + 6000);
      if (body.trim()) chunks.push({ id: `c${chunks.length + 1}`, locator: `${page.locator} · 第 ${Math.floor(offset / 6000) + 1} 段`, text: body });
    }
  }
  const source = { id: uid(), title, url, kind, hash: fingerprint, chunks, createdAt: now() };
  state.sources.push(source);
  return source;
}

export const KINDS = ['热点', '观点', '事实论据', '案例', '方法', '工具资料'];
export function titleFromQuote(quote) {
  const text = quote.trim().slice(0, 100);
  return text.split(/[。！？!?；;\n]/, 1)[0].trim() || text;
}

/** Older blocks stored an AI paraphrase as body. Keep only text found verbatim in the saved source. */
export function normalizeQuotedBlocks(state) {
  let changed = 0;
  for (const block of state.blocks) {
    const chunk = state.sources.find(source => source.id === block.sourceId)?.chunks.find(item => item.id === block.chunkId);
    if (!chunk || typeof block.quote !== 'string' || !chunk.text.includes(block.quote)) continue;
    const quoted = typeof block.body === 'string' && chunk.text.includes(block.body.trim()) ? block.body.trim() : block.quote;
    const title = titleFromQuote(quoted);
    if (block.body !== quoted || block.quote !== quoted || block.title !== title) {
      block.body = quoted; block.quote = quoted; block.title = title; changed++;
    }
  }
  return changed;
}

export function reviewQuotedBlock(state, id, status, text, kind) {
  const block = state.blocks.find(item => item.id === id);
  if (!block || block.status !== 'pending') throw new Error('该知识块已处理，请刷新');
  if (!['approved', 'rejected'].includes(status)) throw new Error('无效审核操作');
  if (status === 'approved') {
    if (typeof text !== 'string' || !text.trim() || text.length > 5000 || !KINDS.includes(kind)) throw new Error('请检查知识块原句和分类');
    const excerpt = text.trim();
    const chunk = state.sources.find(source => source.id === block.sourceId)?.chunks.find(item => item.id === block.chunkId);
    if (!chunk?.text.includes(excerpt)) throw new Error('修改后的文字必须能在对应原文段落中逐字找到；请先打开原文核对。');
    block.body = excerpt; block.quote = excerpt; block.title = titleFromQuote(excerpt); block.kind = kind;
  }
  block.status = status; block.reviewedAt = now();
  return block;
}

export const outputSchema = {
  type: 'object', additionalProperties: false, required: ['answer', 'blocks'],
  properties: {
    answer: { type: 'string' },
    blocks: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['kind', 'quote', 'sourceId', 'chunkId', 'tags', 'bundle', 'bundleType', 'role'],
      properties: {
        kind: { type: 'string', enum: KINDS }, quote: { type: 'string' }, sourceId: { type: 'string' }, chunkId: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }, bundle: { type: 'string' },
        bundleType: { type: 'string', enum: ['viewpoint', 'tutorial', 'case', 'interview', 'data', 'concept', 'mixed'] },
        role: { type: 'string', enum: ['definition', 'claim', 'reason', 'problem', 'context', 'prerequisite', 'mechanism', 'evidence', 'example', 'comparison', 'counterpoint', 'formula', 'variable', 'step', 'tool', 'action', 'result', 'caveat', 'lesson'] },
      } } },
  },
};

export function validateAnalysis(value, sourceChunks) {
  if (!value || typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 24000 || !Array.isArray(value.blocks) || value.blocks.length > 30) throw new Error('AI 返回格式不完整，请重试；没有伪造基础拆解。');
  const blocks = value.blocks.map(block => {
    const chunk = sourceChunks.find(item => item.sourceId === block.sourceId && item.id === block.chunkId);
    const quote = typeof block.quote === 'string' ? block.quote.trim() : '';
    const bundleTypes = ['viewpoint', 'tutorial', 'case', 'interview', 'data', 'concept', 'mixed'];
    const roles = ['definition', 'claim', 'reason', 'problem', 'context', 'prerequisite', 'mechanism', 'evidence', 'example', 'comparison', 'counterpoint', 'formula', 'variable', 'step', 'tool', 'action', 'result', 'caveat', 'lesson'];
    if (!KINDS.includes(block.kind) || !quote || quote.length > 5000 || !Array.isArray(block.tags) || block.tags.length > 10 || block.tags.some(tag => typeof tag !== 'string' || tag.length > 50) || typeof block.bundle !== 'string' || block.bundle.trim().length < 2 || block.bundle.trim().length > 80 || !bundleTypes.includes(block.bundleType) || !roles.includes(block.role) || !chunk || !chunk.text.includes(quote)) {
      throw new Error('AI 提炼中存在无法匹配原文的引用或无效字段，已拦截本段结果。请重试。');
    }
    const bundleTitle = block.bundle.trim();
    const bundleId = hash(`${block.sourceId}\0${bundleTitle.toLowerCase().replace(/\s+/g, '')}`).slice(0, 20);
    return { id: uid(), kind: block.kind, title: titleFromQuote(quote), body: quote, quote, sourceId: block.sourceId, chunkId: block.chunkId, locator: chunk.locator, tags: block.tags, bundleId, bundleTitle, bundleType: block.bundleType, bundleRole: block.role, status: 'pending', verification: '未核验', createdAt: now() };
  });
  return { answer: value.answer, blocks };
}

export function relevantBlocks(state, query) {
  const terms = [...new Set((query.toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2}/g) || []))];
  const approved = state.blocks.filter(block => block.status === 'approved');
  const matches = approved.map(block => ({ block, score: terms.reduce((sum, term) => sum + (`${block.bundleTitle || ''} ${block.title} ${block.body} ${block.tags.join(' ')}`.toLowerCase().includes(term) ? 1 : 0), 0) })).filter(item => item.score > 0).sort((a,b) => b.score-a.score);
  const result = [];
  for (const { block } of matches) {
    const candidates = block.bundleId ? approved.filter(item => item.bundleId === block.bundleId) : [block];
    for (const candidate of candidates) if (!result.some(item => item.id === candidate.id)) result.push(candidate);
    if (result.length >= 8) break;
  }
  return result.slice(0, 8);
}

export function publicState(state) {
  return { ...state, sources: state.sources.map(({ chunks, ...item }) => ({ ...item, chunkCount: chunks.length, characters: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) })) };
}
