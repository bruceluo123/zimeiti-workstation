import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { searchWeb, validateWebAnswer } from '../scripts/assistant/web-search.mjs';

test('answer keeps distinct public HTTPS sources across ordinary topics', () => {
  const base = { title: '学校官网介绍', publisher: '学校官网', note: '支持学校名称和地点。' };
  const result = validateWebAnswer({ answer: '这是一所学校。', sources: [
    { ...base, url: 'http://localhost/private' },
    { ...base, url: 'https://127.0.0.1/private' },
    { ...base, url: 'https://example.com/story#section' },
    { ...base, url: 'https://example.com/story#section' },
    { title: 'A research paper', publisher: 'PLOS', url: 'https://journals.plos.org/plosone/article', note: 'Only shown when relevant to the question.' },
  ] });
  assert.deepEqual(result, { answer: '这是一所学校。', sources: [{ ...base, url: 'https://example.com/story' }, { title: 'A research paper', publisher: 'PLOS', url: 'https://journals.plos.org/plosone/article', note: 'Only shown when relevant to the question.' }] });
  assert.deepEqual(validateWebAnswer({ answer: '没有依据的回答', sources: [] }), { answer: '', sources: [] });
});

test('a model answer without a completed web search cannot be presented as sourced', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zmt-web-search-test-'));
  const fake = path.join(dir, 'fake-codex.mjs');
  const before = process.env.ZMT_CODEX_LAUNCHER;
  try {
    await writeFile(fake, `process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({answer:'Made up',sources:[{title:'Example',publisher:'Example',url:'https://example.com/story'}]})}})+'\\n'); process.stdout.write(JSON.stringify({type:'turn.completed'})+'\\n');`);
    process.env.ZMT_CODEX_LAUNCHER = fake;
    await assert.rejects(searchWeb({ cwd: dir, question: '蛇口贝赛思是什么' }), /没有实际调用网页搜索/);
  } finally {
    if (before === undefined) delete process.env.ZMT_CODEX_LAUNCHER; else process.env.ZMT_CODEX_LAUNCHER = before;
    await rm(dir, { recursive: true, force: true });
  }
});
