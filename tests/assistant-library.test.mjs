import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initialState, readState, updateState, relevantBlocks } from '../scripts/assistant/store.mjs';
import { normalizeLibrarySources, queueLibraryExtraction, queueLibraryExtractionWithOptions } from '../scripts/assistant/library.mjs';
import { work } from '../scripts/assistant/worker.mjs';

const material = { id: 'article-1', title: '长期积累', body: '作者认为，反复练习有助于形成自己的方法。', url: 'https://example.com/essay', author: '示例作者', coverage: 'full', captureMethod: 'pasted_text' };

test('validates the whole selection before inserting anything; summary cannot replace source text', () => {
  const state = initialState();
  assert.throws(() => queueLibraryExtraction(state, [material, { ...material, id: 'bad', body: '' }], 'test'), /没有正文/);
  assert.equal(state.sources.length, 0);
  assert.throws(() => normalizeLibrarySources([{ ...material, coverage: 'preview' }]), /正文/);
  assert.throws(() => normalizeLibrarySources([{ ...material, captureMethod: 'link_only' }]), /正文/);
  assert.throws(() => normalizeLibrarySources([{ ...material, status: 'failed' }]), /正文/);
  assert.throws(() => normalizeLibrarySources(Array(11).fill(material)), /1—10/);
  const result = queueLibraryExtraction(state, [{ ...material, analysis: { summary: '伪造的摘要' } }], 'test');
  assert.ok(result.jobId);
  assert.equal(state.sources[0].chunks[0].text, material.body);
  assert.equal(state.sources[0].author, material.author);
  assert.deepEqual(state.sources[0].librarySourceIds, [material.id]);
});

test('duplicates reuse extraction, edits create a new snapshot, failed jobs retain retry identity', () => {
  const state = initialState();
  const first = queueLibraryExtraction(state, [material], 'test');
  assert.throws(() => queueLibraryExtraction(state, [material], 'test'), /当前有/);
  state.jobs[0].status = 'completed';
  const repeated = queueLibraryExtraction(state, [{ ...material, id: 'another-id' }], 'test');
  assert.equal(repeated.jobId, null);
  assert.equal(repeated.skipped[0].jobId, first.jobId);
  assert.equal(state.sources.length, 1);
  assert.deepEqual(state.sources[0].librarySourceIds, ['article-1', 'another-id']);
  const upgraded = queueLibraryExtractionWithOptions(state, [{ ...material, id: 'another-id' }], 'test', { force: true });
  assert.ok(upgraded.jobId);
  assert.equal(state.jobs.at(-1).schemaVersion, 3);
  state.jobs.at(-1).status = 'completed';
  const revised = queueLibraryExtraction(state, [{ ...material, body: `${material.body}新补充的案例。` }], 'test');
  assert.notEqual(revised.sourceIds[0], first.sourceIds[0]);
  assert.equal(state.sources[0].chunks[0].text, material.body);
  state.jobs.at(-1).status = 'failed';
  const failed = queueLibraryExtraction(state, [{ ...material, body: `${material.body}新补充的案例。` }], 'test');
  assert.equal(failed.jobId, null);
  assert.equal(failed.skipped[0].jobId, revised.jobId);
});

test('source → extraction → review → retrieval keeps provenance and never approves automatically', async () => {
  process.env.ZMT_KNOWLEDGE_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'zmt-library-test-'));
  await updateState(state => queueLibraryExtraction(state, [material], 'test'));
  let calls = 0;
  await work({ analyze: async ({ prompt }) => {
    calls++;
    const { sources } = JSON.parse(prompt);
    assert.equal(sources[0].author, material.author);
    assert.equal(sources[0].url, material.url);
    return { model: 'test', parsed: { answer: '提炼完成', blocks: [{ kind: '观点', quote: '反复练习有助于形成自己的方法', sourceId: sources[0].sourceId, chunkId: sources[0].id, tags: ['练习'], bundle: '练习方法', bundleType: 'concept', role: 'mechanism' }] } };
  } });
  const state = await readState();
  assert.equal(calls, 1);
  assert.equal(state.jobs[0].status, 'completed');
  assert.equal(state.blocks[0].status, 'pending');
  assert.equal(state.blocks[0].body, state.blocks[0].quote);
  assert.equal(state.blocks[0].sourceId, state.sources[0].id);
  assert.equal(relevantBlocks(state, '反复练习').length, 0);
  await updateState(draft => { draft.blocks[0].status = 'approved'; });
  const approved = await readState();
  assert.equal(relevantBlocks(approved, '反复练习').length, 1);
  assert.equal(approved.sources[0].url, material.url);
});
