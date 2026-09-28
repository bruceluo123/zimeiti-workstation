import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, addSource, validateAnalysis } from '../scripts/assistant/store.mjs';
import { applyWriting, writingState, retrieveWriting, usageFor, validateEvidence, safeUrl } from '../scripts/assistant/writing.mjs';

function fixture() {
  const state = initialState();
  const source = addSource(state, { title: '验收资料', text: '持续输出需要稳定的节奏。频繁换工具可能打断练习。', url: 'https://example.com/source' });
  const { blocks } = validateAnalysis({ answer: '测试', blocks: [{ kind: '观点', quote: '持续输出需要稳定的节奏。', sourceId: source.id, chunkId: 'c1', tags: ['创作'], bundle: '持续输出', bundleType: 'viewpoint', role: 'claim' }] }, source.chunks.map(chunk => ({ ...chunk, sourceId: source.id })));
  blocks[0].status = 'approved'; state.blocks.push(...blocks);
  const draft = applyWriting(state, { action: 'create' });
  const send = input => applyWriting(state, { id: draft.id, revision: draft.revision, ...input });
  return { state, draft, block: blocks[0], send };
}
test('old draft import is idempotent, changed legacy content is a separate copy; original remains', () => {
  const { state } = fixture();
  const legacy = { id: 'old', title: '旧稿', body: '原文', evidence: [{ sourceId: 's', quote: '摘录', sourceTitle: '原始来源' }] };
  const a = applyWriting(state, { action: 'import', draft: legacy });
  assert.equal(applyWriting(state, { action: 'import', draft: legacy }).id, a.id);
  assert.notEqual(applyWriting(state, { action: 'import', draft: { ...legacy, body: '另一个版本' } }).id, a.id);
  assert.equal(a.body, '原文'); assert.equal(a.references[0].status, 'memo');
});
test('choosing an inspiration creates one independent draft and keeps the original note', () => {
  const { state } = fixture();
  const thought = { id: 'thought-1', content: '先写一个判断\n再补充理由' };
  const draft = applyWriting(state, { action: 'createFromThought', thought });
  assert.equal(draft.title, '先写一个判断');
  assert.equal(draft.body, thought.content);
  assert.equal(draft.sourceThoughtId, thought.id);
  assert.equal(applyWriting(state, { action: 'createFromThought', thought }).id, draft.id);
  applyWriting(state, { action: 'save', id: draft.id, revision: draft.revision, title: draft.title, body: '修改后的正文' });
  assert.equal(thought.content, '先写一个判断\n再补充理由');
  assert.throws(() => applyWriting(state, { action: 'createFromThought', thought: { id: 'empty', content: '   ' } }), /有文字/);
});
test('insert has server-derived provenance; stale writes rejected; usage deduplicates by draft', () => {
  const { state, draft, block, send } = fixture();
  send({ action: 'save', title: '我的稿子', body: '我的观点。' });
  const previous = draft.revision;
  send({ action: 'insert', blockId: block.id, mode: 'quote', position: 2 });
  assert.match(draft.body, /我的“持续输出需要稳定的节奏。”〔引1〕观点。/);
  assert.equal(draft.references[0].sourceUrl, 'https://example.com/source');
  assert.throws(() => send({ action: 'save', revision: previous, title: '', body: '' }), /其他窗口/);
  send({ action: 'insert', blockId: block.id, mode: 'quote', position: 0 });
  assert.equal(usageFor(state, block.id).filter(item => item.active).length, 1);
  assert.equal(writingState(state).events.filter(item => item.action === 'insert').length, 2);
});
test('editing and undo preserve user prose, delete marker deactivates usage, publication snapshots remain', () => {
  const { state, draft, block, send } = fixture();
  send({ action: 'insert', blockId: block.id, mode: 'quote', position: 0 });
  send({ action: 'publish', url: 'https://example.com/post' });
  send({ action: 'save', title: '测试', body: '自己改写后的话' + draft.references[0].marker });
  assert.equal(draft.references[0].status, 'modified');
  send({ action: 'remove', referenceId: draft.references[0].id });
  assert.equal(draft.body, '自己改写后的话');
  assert.equal(usageFor(state, block.id)[0].active, false);
  assert.equal(usageFor(state, block.id)[0].publications.length, 1);
  send({ action: 'unpublish', publicationId: draft.publications[0].id });
  assert.equal(usageFor(state, block.id)[0].publications.length, 0);
});
test('exact insertion undo restores original; memo does not inflate usage or revive after removal', () => {
  const { state, draft, block, send } = fixture();
  send({ action: 'save', title: '', body: '前后' });
  send({ action: 'insert', blockId: block.id, mode: 'quote', position: 1 });
  send({ action: 'remove', referenceId: draft.references[0].id });
  assert.equal(draft.body, '前后');
  send({ action: 'memo', blockId: block.id }); send({ action: 'memo', blockId: block.id });
  assert.equal(draft.references.length, 2);
  assert.equal(usageFor(state, block.id)[0].active, false);
  send({ action: 'remove', referenceId: draft.references[1].id });
  send({ action: 'save', title: '', body: '前后修改' });
  assert.equal(draft.references[1].status, 'removed');
});
test('Chinese overlapping terms retrieve only approved, source-valid blocks; fabricated AI IDs rejected', () => {
  const { state, block, send } = fixture();
  assert.equal(retrieveWriting(state, '我想持续输出')[0].block.id, block.id);
  assert.equal(retrieveWriting(state, '天文学').length, 0);
  assert.throws(() => validateEvidence({ suggestions: [{ blockId: 'invented', role: '支持论据', reason: '', caution: '' }], gaps: [] }, retrieveWriting(state, '持续输出')));
  block.status = 'pending'; assert.equal(retrieveWriting(state, '持续输出').length, 0);
  assert.throws(() => send({ action: 'insert', blockId: block.id, mode: 'quote', position: 0 }), /未确认/);
  block.status = 'approved'; block.quote = '伪造的原话';
  assert.equal(retrieveWriting(state, '持续输出').length, 0);
  assert.equal(safeUrl('javascript:alert(1)'), '');
});
test('recovery keeps server-derived references and never overwrites newer drafts', () => {
  const { state, draft, block, send } = fixture();
  send({ action: 'insert', blockId: block.id, mode: 'quote', position: 0 });
  const copy = structuredClone(draft); copy.body = '额外未保存文字' + copy.body;
  copy.references[0].sourceTitle = '伪造来源';
  copy.references.push({ id: 'fake', sourceTitle: '伪造来源' });
  const recovered = applyWriting(state, { action: 'recover', draft: copy });
  assert.notEqual(recovered.id, draft.id); assert.equal(recovered.references.length, 1);
  assert.equal(recovered.references[0].sourceTitle, '验收资料');
  assert.equal(recovered.references[0].status, 'active'); assert.ok(!draft.body.startsWith('额外'));
  assert.equal(applyWriting(state, { action: 'recover', draft: copy }).id, recovered.id);
});
