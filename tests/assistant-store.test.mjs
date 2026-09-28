import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialState, addSource, validateAnalysis, relevantBlocks, readState, updateState, publicState, acquireLock, normalizeQuotedBlocks, reviewQuotedBlock, outputSchema } from '../scripts/assistant/store.mjs';
import { contextFor, work } from '../scripts/assistant/worker.mjs';

test('text is split without losing characters; same material deduplicates', () => {
  const state = initialState(); const text = '长文论据。'.repeat(2300);
  const first = addSource(state, { title: '书', text });
  assert.equal(first.chunks.map(chunk => chunk.text).join(''), text);
  assert.equal(addSource(state, { title: '再次导入', text }).id, first.id);
  assert.equal(state.sources.length, 1);
  assert.notEqual(addSource(state, { title: '另一个来源', text, url: 'https://example.com/different-author' }).id, first.id);
  assert.ok(publicState(state).sources[0].chunkCount > 1);
  assert.equal(publicState(state).sources[0].chunks, undefined);
});
test('page provenance and quote matching: hallucinated or mismatched quotes are rejected', () => {
  const state = initialState();
  const source = addSource(state, { title: 'PDF', pages: [{ locator: '第 2 页', text: '测试原文：这是作者的观点，并非独立核实的事实。' }] });
  const chunks = source.chunks.map(chunk => ({ ...chunk, sourceId: source.id }));
  const output = { answer: '有用的分析', blocks: [{ kind: '观点', quote: ' 这是作者的观点\n', sourceId: source.id, chunkId: 'c1', tags: ['测试'], bundle: '作者观点', bundleType: 'viewpoint', role: 'claim' }] };
  const block = validateAnalysis(output, chunks).blocks[0];
  assert.equal(block.locator, '第 2 页 · 第 1 段');
  assert.equal(block.body, '这是作者的观点');
  assert.equal(block.title, '这是作者的观点');
  assert.equal(block.bundleTitle, '作者观点');
  assert.equal(block.bundleType, 'viewpoint');
  assert.equal(block.bundleRole, 'claim');
  assert.deepEqual(outputSchema.properties.blocks.items.required, ['kind', 'quote', 'sourceId', 'chunkId', 'tags', 'bundle', 'bundleType', 'role']);
  assert.throws(() => validateAnalysis({ ...output, blocks: [{ ...output.blocks[0], quote: '伪造数据' }] }, chunks), /已拦截/);
  assert.throws(() => validateAnalysis({ ...output, blocks: [{ ...output.blocks[0], sourceId: 'other' }] }, chunks));
  assert.throws(() => validateAnalysis({ answer: '', blocks: [] }, chunks));
});

test('old AI summaries become source quotes; approval accepts only continuous source text', () => {
  const state = initialState();
  const source = addSource(state, { title: '文章', text: '开头。学习要自己主动寻找问题，才会形成判断。结尾。' });
  state.blocks.push({ id: 'old', status: 'pending', title: '学习是自发性的', body: '作者说主动学习很重要。', quote: '学习要自己主动寻找问题，才会形成判断。', sourceId: source.id, chunkId: 'c1', kind: '观点', tags: [] });
  assert.equal(normalizeQuotedBlocks(state), 1);
  assert.equal(state.blocks[0].body, '学习要自己主动寻找问题，才会形成判断。');
  assert.equal(state.blocks[0].title, '学习要自己主动寻找问题，才会形成判断');
  assert.equal(normalizeQuotedBlocks(state), 0);
  assert.throws(() => reviewQuotedBlock(state, 'old', 'approved', '学习是自发性的', '观点'), /逐字找到/);
  assert.equal(state.blocks[0].status, 'pending');
  const approved = reviewQuotedBlock(state, 'old', 'approved', '学习要自己主动寻找问题', '观点');
  assert.equal(approved.body, approved.quote);
  assert.equal(approved.status, 'approved');
  assert.ok(source.chunks[0].text.includes(approved.body));
});
test('knowledge retrieval includes only approved matching blocks; other conversation is excluded', () => {
  const state = initialState();
  state.blocks = [{ id: 'a', status: 'approved', title: '个人成长', body: '积累案例', tags: [] }, { id: 'b', status: 'pending', title: '个人成长', body: '秘密', tags: [] }];
  assert.deepEqual(relevantBlocks(state, '个人成长').map(block => block.id), ['a']);
  state.conversations = [{ id: 'one', messages: [{ role: 'user', text: '同一对话', jobId: 'old' }] }, { id: 'two', messages: [{ role: 'user', text: '别的对话私密内容' }] }];
  const context = contextFor(state, { conversationId: 'one', id: 'new', message: '个人成长', profile: '我的档案' }, []);
  assert.match(context.prompt, /同一对话/); assert.doesNotMatch(context.prompt, /别的对话私密内容/);
});
test('knowledge retrieval expands a matched block to its approved theme siblings', () => {
  const state = initialState();
  state.blocks = [
    { id: 'formula', status: 'approved', bundleId: 'wealth', bundleTitle: '财富自由门槛', title: '年消费乘25', body: '年消费乘以25', tags: ['财务自由'] },
    { id: 'example', status: 'approved', bundleId: 'wealth', bundleTitle: '财富自由门槛', title: '四十万对应一千万', body: '四十万乘25是一千万', tags: ['案例'] },
    { id: 'other', status: 'approved', bundleId: 'house', bundleTitle: '房产', title: '房产', body: '房产观点', tags: [] },
  ];
  assert.deepEqual(relevantBlocks(state, '财务自由').map(block => block.id), ['formula', 'example']);
});
test('persistence serializes concurrent changes and refuses corrupted state instead of resetting', async () => {
  process.env.ZMT_KNOWLEDGE_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'zmt-kb-test-'));
  await Promise.all(Array.from({ length: 12 }, (_, index) => updateState(state => { state.conversations.push({ id: String(index), messages: [] }); })));
  assert.equal((await readState()).conversations.length, 12);
  assert.ok(JSON.parse(await readFile(path.join(process.env.ZMT_KNOWLEDGE_DATA_DIR, 'state.backup.json'), 'utf8')).conversations.length);
  const unlock = await acquireLock('worker', 100);
  await assert.rejects(acquireLock('worker', 100), /正忙/); await unlock();
  await writeFile(path.join(process.env.ZMT_KNOWLEDGE_DATA_DIR, 'state.json'), '{broken');
  await assert.rejects(updateState(state => { state.profile = 'should not overwrite'; }), /停止写入/);
  assert.equal(await readFile(path.join(process.env.ZMT_KNOWLEDGE_DATA_DIR, 'state.json'), 'utf8'), '{broken');
});

test('worker resumes only unfinished batches and preserves failed/cancelled checkpoints', async () => {
  process.env.ZMT_KNOWLEDGE_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'zmt-worker-test-'));
  await updateState(state => {
    const source = addSource(state, { title: '长书', text: '可追溯的原文。'.repeat(4000) });
    state.conversations.push({ id: 'chat', title: '续跑', messages: [] });
    state.blocks.push(
      { id: 'legacy-pending', sourceId: source.id, status: 'pending', title: '旧待确认', body: '旧待确认', tags: [] },
      { id: 'legacy-approved', sourceId: source.id, status: 'approved', title: '旧已确认', body: '旧已确认', tags: [] },
    );
    state.jobs.push({ id: 'job', conversationId: 'chat', mode: 'extract', schemaVersion: 3, message: '提炼方法', sourceIds: [source.id], profile: '不要编造', status: 'queued', completed: 1 });
  });
  const seenChunks = [];
  await work({ analyze: async ({ prompt }) => {
    const { sources } = JSON.parse(prompt);
    seenChunks.push(sources[0].id);
    return { model: 'test', parsed: { answer: '最后一批', blocks: [] } };
  } });
  let state = await readState();
  assert.deepEqual(seenChunks, ['c3', 'c5']); assert.equal(state.jobs[0].completed, 3); assert.equal(state.jobs[0].status, 'completed');
  assert.deepEqual(state.blocks.map(block => block.id), ['legacy-approved']);
  await updateState(draft => { draft.jobs[0].status = 'queued'; draft.jobs[0].completed = 1; });
  await work({ analyze: async () => { throw new Error('模拟额度不足'); } });
  state = await readState(); assert.equal(state.jobs[0].status, 'failed'); assert.equal(state.jobs[0].completed, 1);
  await updateState(draft => { draft.jobs[0].status = 'queued'; });
  await work({ analyze: async () => {
    await updateState(draft => { draft.jobs[0].status = 'cancelled'; });
    return { model: 'test', parsed: { answer: '不应保存', blocks: [] } };
  } });
  state = await readState(); assert.equal(state.jobs[0].status, 'cancelled'); assert.equal(state.jobs[0].completed, 1);
  assert.equal(state.conversations[0].messages.length, 2);
  await updateState(draft => { draft.jobs[0].status = 'running'; });
  await work({ analyze: async () => { throw new Error('should not run'); } });
  assert.equal((await readState()).jobs[0].status, 'failed');
});
