import test from 'node:test';
import assert from 'node:assert/strict';
import { isKbData, isDocDetail, readKnowledgeResponse, KnowledgeRequestError, wikiLinkId } from '../src/components/knowledge/response.ts';

const data = { hubCards: [], graph: { nodes: [], edges: [] }, searchIndex: [], stats: { total: 0, hubs: 0, sources: 0, edges: 0 } };
const doc = { id: 'doc', title: '文档', tags: [], summary: '', kind: 'hub', path: 'doc', outLinks: [], todos: [], content: '# 文档', created: '', updated: '', obsidianUri: 'obsidian://open' };

test('HTTP failures never become knowledge data, including non-JSON authentication errors', async () => {
  await assert.rejects(readKnowledgeResponse(Response.json({ error: '请先登录工作站' }, { status: 401 }), isKbData), error => error instanceof KnowledgeRequestError && error.status === 401 && error.message.includes('登录'));
  await assert.rejects(readKnowledgeResponse(new Response('<html>denied</html>', { status: 403 }), isKbData), error => error.status === 403 && error.message.includes('所有者'));
  await assert.rejects(readKnowledgeResponse(Response.json({ error: '已移动' }, { status: 404 }), isDocDetail), error => error.status === 404 && error.message === '已移动');
});

test('malformed success bodies cannot reach the rendering state', async () => {
  for (const value of [null, { error: 'login' }, { ...data, stats: null }, { ...data, hubCards: [null] }, { ...data, graph: { nodes: [{}], edges: [] } }, { ...data, searchIndex: [{ id: 'x' }] }]) {
    await assert.rejects(readKnowledgeResponse(Response.json(value), isKbData), /数据不完整/);
  }
  await assert.rejects(readKnowledgeResponse(new Response('<html>not JSON</html>'), isKbData), /数据不完整/);
  await assert.rejects(readKnowledgeResponse(Response.json({ ...doc, content: null }), isDocDetail), /数据不完整/);
  await assert.rejects(readKnowledgeResponse(Response.json({ ...doc, updated: {} }), isDocDetail), /数据不完整/);
  const entry = { id: 'duplicate', title: '', tags: '', summary: '', kind: 'other', path: '' };
  assert.equal(isKbData({ ...data, searchIndex: [entry, entry] }), false, 'duplicate IDs would crash the search index');
});

test('valid empty knowledge and document responses remain usable', async () => {
  assert.deepEqual(await readKnowledgeResponse(Response.json(data), isKbData), data);
  assert.deepEqual(await readKnowledgeResponse(Response.json(doc), isDocDetail), doc);
});

test('invalid UTF-8 wiki links become inert text instead of throwing during document rendering', () => {
  assert.equal(wikiLinkId('?wiki=%FF'), null);
  assert.equal(wikiLinkId('?wiki=%E0'), null);
  assert.equal(wikiLinkId('?wiki='), null);
  assert.equal(wikiLinkId('?wiki=%E7%9F%A5%E8%AF%86%E6%80%BB%E5%9B%BE'), '知识总图');
});
