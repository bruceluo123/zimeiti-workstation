import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceIdentity } from '../scripts/collect-source.mjs';

test('collector rejects credentials, foreign domains and shell-like inputs', () => {
  for (const value of ['https://x.com.evil.test/a', 'https://user:pass@x.com/a/status/1', 'http://x.com/u/status/1', 'https://x.com:8000/u/status/1', 'https://127.0.0.1/a', 'whoami']) assert.throws(() => sourceIdentity(value));
});
test('tracking and user alias do not duplicate X material', () => {
  assert.equal(sourceIdentity('https://x.com/a/status/123?s=20').id, sourceIdentity('https://twitter.com/b/status/123').id);
});
test('a short video share remains video, not inferred article text', () => {
  assert.equal(sourceIdentity('复制 https://v.douyin.com/test/').platform, 'douyin');
  assert.equal(sourceIdentity('https://www.xiaohongshu.com/discovery/item/6a37e85900000000220153ef?xsec_token=abc').platform, 'xiaohongshu');
});
