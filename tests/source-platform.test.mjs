import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalSourceUrl, isSupportedPublicHost, parseSourceUrl, platformOf } from "../src/lib/sources/platform.ts";

test("core share links are classified and generic links require pasted text", () => {
  const cases = [
    ["https://x.com/Global_Funny_/status/123", "x"],
    ["https://xhslink.com/abc", "xiaohongshu"],
    ["https://v.douyin.com/abc", "douyin"],
    ["https://mp.weixin.qq.com/s/abc", "wechat"],
    ["https://m.weibo.cn/detail/123", "weibo"],
  ];
  for (const [value, expected] of cases) {
    const url = parseSourceUrl(value);
    assert.ok(url);
    assert.equal(platformOf(url), expected);
    assert.equal(isSupportedPublicHost(url), true);
  }
  assert.equal(isSupportedPublicHost(new URL("https://example.org/post")), false);
  assert.equal(isSupportedPublicHost(new URL("https://x.com.attacker.invalid/status/123")), false);
});

test("URL input refuses unsafe schemes, credentials and nonstandard ports", () => {
  assert.equal(parseSourceUrl("http://x.com/abc"), null);
  assert.equal(parseSourceUrl("https://user:password@x.com/abc"), null);
  assert.equal(parseSourceUrl("https://x.com:8443/abc"), null);
  assert.equal(parseSourceUrl("javascript:alert(1)"), null);
});

test("X post URLs deduplicate across twitter.com and x.com", () => {
  const left = parseSourceUrl("https://twitter.com/person/status/123?utm_source=share");
  const right = parseSourceUrl("https://x.com/another/status/123");
  assert.ok(left && right);
  assert.equal(canonicalSourceUrl(left), canonicalSourceUrl(right));
});
