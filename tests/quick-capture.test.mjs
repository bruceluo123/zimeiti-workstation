import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQuickCapture } from '../src/lib/sources/quick.ts';
import { isPrivateNetworkAddress } from '../src/lib/sources/extract.ts';

test('core platform links use the authenticated collector', () => {
  const x = parseQuickCapture('这条值得留 https://x.com/person/status/123?s=20');
  assert.equal(x.mode, 'collect');
  assert.equal(x.platform, 'x');
  const douyin = parseQuickCapture('7.10 复制打开抖音 https\\://v.douyin.com/example/');
  assert.equal(douyin.mode, 'collect');
  assert.equal(douyin.platform, 'douyin');
});

test('pasted article text keeps exact wording and optional provenance', () => {
  const plain = parseQuickCapture('学习不是记住答案，而是不断修正自己的判断。');
  assert.equal(plain.mode, 'text');
  assert.equal(plain.text, '学习不是记住答案，而是不断修正自己的判断。');
  assert.match(plain.title, /^学习不是/);
  const article = parseQuickCapture('https://example.org/essay\n作者认为，真正的复利来自持续行动。', '复利文章');
  assert.equal(article.mode, 'text');
  assert.equal(article.text, '作者认为，真正的复利来自持续行动。');
  assert.equal(article.title, '复利文章');
  assert.equal(article.url, 'https://example.org/essay');
});

test('a generic article link uses the guarded public-page reader', () => {
  assert.equal(parseQuickCapture('https://example.org/essay').mode, 'article-url');
  assert.throws(() => parseQuickCapture(' '), /请粘贴/);
});

test('the article reader refuses local, private and documentation addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.8', '172.20.1.2', '192.168.1.2', '169.254.3.4', '::1', 'fd00::1', '2001:db8::1']) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false);
  assert.equal(isPrivateNetworkAddress('2606:4700:4700::1111'), false);
});
