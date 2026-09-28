import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const asModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const types = asModule(await readFile(new URL('../src/types/source.ts', import.meta.url), 'utf8'));
const code = (await readFile(new URL('../src/lib/sources/import.ts', import.meta.url), 'utf8')).replaceAll('"@/types/source"', JSON.stringify(types));
const { decodeSourceBundle } = await import(asModule(code));
const row = { id: 'example', platform: 'x', body: '这是来源里的真实观点。', title: '示例', url: 'https://x.com/example/status/123' };

test('imports untrusted bundles without carrying credentials or invented quotations', () => {
  const [result] = decodeSourceBundle({ sources: [{ ...row, token: 'must-not-export', analysis: { category: '思想观点', summary: '摘要', evidence: [null, { quote: '真实观点', kind: '观点' }, { quote: '编造数字' }] }, repositories: [null, { url: 'javascript:alert(1)' }, { url: 'https://github.com/a/b', purpose: '用途' }] }] });
  assert.equal(result.token, undefined);
  assert.equal(result.analysis.evidence.length, 1);
  assert.equal(result.analysis.evidence[0].verification, '来源陈述，未独立核实');
  assert.equal(result.repositories.length, 1);
});

test('validates complete bundle before allowing storage', () => {
  assert.throws(() => decodeSourceBundle([row, { ...row, id: '../../bad' }]));
  assert.throws(() => decodeSourceBundle([row, { ...row, analysis: 'invalid' }]));
  assert.equal(decodeSourceBundle(Array(608).fill(row)).length, 608);
  assert.throws(() => decodeSourceBundle(Array(1001).fill(row)));
});

test('preserves a book entry hierarchy and reference links', () => {
  const book = { id: 'how-to-live-better', title: '高性价比人生指南', url: 'https://example.com/book/', chapterNumber: 4, chapterTitle: '不要浪费时间', chapterIntro: '章节简介', itemNumber: 11, anchor: 's4-11', grade: 'A', ratio: '一般', lead: '概述', references: [{ text: '研究出处', urls: ['https://doi.org/10.1234/example'] }] };
  const [result] = decodeSourceBundle([{ ...row, book }]);
  assert.equal(result.book.anchor, 's4-11');
  assert.equal(result.book.references[0].urls[0], 'https://doi.org/10.1234/example');
});

test('null and malformed transcript segments cannot crash resource pages', () => {
  const [result] = decodeSourceBundle([{ ...row, transcript: { duration: 10, segments: [null, { start: -1, end: 2, text: 'bad' }, { start: 0, end: 2, text: '好' }] } }]);
  assert.equal(result.transcript.segments.length, 1);
  assert.equal(result.transcript.reviewRequired, true);
});
