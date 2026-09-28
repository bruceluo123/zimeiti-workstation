export interface XPost {
  id: string;
  text: string;
  note_post?: { text?: string };
  note_tweet?: { text?: string };
  created_at?: string;
  attachments?: { media_keys?: string[] };
  article_title?: string;
}

interface XTimeline {
  data?: XPost[];
  meta?: { newest_id?: string; next_token?: string };
  errors?: unknown[];
}

export class XApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function xGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.x.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const message = response.status === 401 ? "X 令牌无效或已失效，请重新连接"
      : response.status === 402 ? "X API 余额不足；请先在 X 控制台购买额度并设置消费上限"
      : response.status === 403 ? "X API 拒绝读取，请在 X 控制台检查应用权限和可用额度"
      : response.status === 429 ? "X API 读取频率受限，请稍后再试"
      : "X API 暂时无法读取，请稍后再试";
    throw new XApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export async function lookupOwnXUser(token: string): Promise<string> {
  const result = await xGet<{ data?: { id?: string; username?: string } }>(
    "/2/users/by/username/Global_Funny_", token
  );
  if (!result.data?.id?.match(/^[0-9]{1,19}$/) || result.data.username?.toLowerCase() !== "global_funny_") {
    throw new Error("无法确认 @Global_Funny_ 的 X 用户 ID");
  }
  return result.data.id;
}

export async function readOwnXPosts(token: string, userId: string, sinceId?: string): Promise<{ posts: XPost[]; newestId: string | null }> {
  const posts: XPost[] = [];
  let nextToken: string | undefined;
  let newestId: string | null = null;
  const maxPages = sinceId ? 5 : 1;
  for (let page = 0; page < maxPages; page++) {
    const query = new URLSearchParams({
      max_results: sinceId ? "20" : "10",
      exclude: "replies,retweets",
      "post.fields": "created_at,note_post,attachments,article_title",
    });
    if (sinceId) query.set("since_id", sinceId);
    if (nextToken) query.set("pagination_token", nextToken);
    const result = await xGet<XTimeline>(`/2/users/${userId}/tweets?${query}`, token);
    if (result.errors?.length) throw new Error("X 返回部分读取错误，本轮不会更新同步位置");
    for (const id of [result.meta?.newest_id, ...(result.data ?? []).map((post) => post.id)]) {
      if (id && /^[0-9]{1,19}$/.test(id) && (!newestId || BigInt(id) > BigInt(newestId))) newestId = id;
    }
    posts.push(...(result.data ?? []));
    nextToken = result.meta?.next_token;
    if (!nextToken) return { posts, newestId };
  }
  if (sinceId && nextToken) throw new Error("本轮新帖超过 100 条，已停止以免遗漏或超出读取预算；请联系维护者处理");
  return { posts, newestId };
}

export function fullPostText(post: XPost): string {
  return post.note_post?.text || post.note_tweet?.text || post.text || "";
}
