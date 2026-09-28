import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fullPostText, lookupOwnXUser, readOwnXPosts } from "../src/lib/x/client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("long X posts keep their complete note text", () => {
  assert.equal(fullPostText({ id: "1", text: "truncated…", note_post: { text: "完整原文\n第二行" } }), "完整原文\n第二行");
});

test("first sync reads at most ten own originals", async () => {
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.x.com");
    assert.equal(url.pathname, "/2/users/123/tweets");
    assert.equal(url.searchParams.get("max_results"), "10");
    assert.equal(url.searchParams.get("exclude"), "replies,retweets");
    assert.match(url.searchParams.get("post.fields"), /note_post/);
    assert.equal(options.cache, "no-store");
    return Response.json({
      data: [{ id: "456", text: "正文", created_at: "2026-09-25T00:00:00Z" }],
      meta: { newest_id: "456", next_token: "older" },
    });
  };
  const result = await readOwnXPosts("test-token", "123");
  assert.equal(result.posts.length, 1);
  assert.equal(result.newestId, "456");
});

test("incremental sync reads pages until exhausted", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("since_id"), "100");
    calls++;
    if (calls === 1) {
      assert.equal(url.searchParams.get("pagination_token"), null);
      return Response.json({ data: [{ id: "102", text: "new" }], meta: { newest_id: "102", next_token: "next" } });
    }
    assert.equal(url.searchParams.get("pagination_token"), "next");
    return Response.json({ data: [{ id: "101", text: "older" }], meta: {} });
  };
  const result = await readOwnXPosts("test-token", "123", "100");
  assert.deepEqual(result.posts.map((post) => post.id), ["102", "101"]);
  assert.equal(result.newestId, "102");
});

test("sync advances from post IDs when X omits newest_id", async () => {
  globalThis.fetch = async () => Response.json({
    data: [{ id: "102", text: "new" }, { id: "101", text: "older" }], meta: {},
  });
  const result = await readOwnXPosts("test-token", "123", "100");
  assert.equal(result.newestId, "102");
});

test("username lookup rejects unexpected accounts", async () => {
  globalThis.fetch = async () => Response.json({ data: { id: "123", username: "other" } });
  await assert.rejects(lookupOwnXUser("test-token"), /无法确认/);
});

test("insufficient X credits is reported without exposing credentials", async () => {
  globalThis.fetch = async () => new Response("do-not-echo-response", { status: 402 });
  await assert.rejects(lookupOwnXUser("test-token"), (error) => {
    assert.match(error.message, /余额不足/);
    assert.equal(error.message.includes("test-token"), false);
    assert.equal(error.message.includes("do-not-echo-response"), false);
    return true;
  });
});
