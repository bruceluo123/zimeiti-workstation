import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";
import { decryptToken } from "@/lib/x/credential";
import { fullPostText, lookupOwnXUser, readOwnXPosts, XApiError } from "@/lib/x/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data: connection, error: connectionError } = await owner.supabase.from("x_read_connections")
    .select("token_ciphertext,x_user_id,last_post_id,last_synced_at")
    .eq("workspace_id", owner.workspaceId).single();
  if (connectionError || !connection) return NextResponse.json({ error: "请先连接 X" }, { status: 400 });
  // 防止连续点击带来额外计费；历史首次抓取只取最新 10 条。
  if (connection.last_synced_at && Date.now() - new Date(connection.last_synced_at).getTime() < 5 * 60_000) {
    return NextResponse.json({ error: "刚刚同步过，请 5 分钟后再试，避免重复读取费用" }, { status: 429 });
  }
  try {
    const token = decryptToken(connection.token_ciphertext);
    const userId = connection.x_user_id || await lookupOwnXUser(token);
    const { posts, newestId } = await readOwnXPosts(token, userId, connection.last_post_id || undefined);
    let imported = 0;
    for (const post of posts.slice().reverse()) {
      if (!/^[0-9]{1,19}$/.test(post.id)) throw new Error("X 返回了无效的帖子 ID");
      const body = fullPostText(post);
      if (!body || body.length > 20000) throw new Error("X 帖子正文为空或超出工作站存储限制");
      const { data: source, error: sourceError } = await owner.supabase.from("content_sources")
        .upsert({
          workspace_id: owner.workspaceId, origin_platform: "x", external_id: post.id,
          source_url: `https://x.com/Global_Funny_/status/${post.id}`, ownership: "mine",
          content_type: "text", published_at: post.created_at ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "workspace_id,origin_platform,external_id" }).select("id").single();
      if (sourceError || !source) throw new Error("保存 X 帖子来源失败");
      const hash = createHash("sha256").update(body).digest("hex");
      const { error: revisionError } = await owner.supabase.from("content_revisions")
        .upsert({
          workspace_id: owner.workspaceId, source_id: source.id, body, content_hash: hash,
          media: (post.attachments?.media_keys ?? []).map((key) => ({ media_key: key })),
        }, { onConflict: "source_id,content_hash", ignoreDuplicates: true });
      if (revisionError) throw new Error("保存 X 帖子正文失败");
      const { error: draftError } = await owner.supabase.rpc("create_weibo_draft_from_source", {
        input_source_id: source.id,
        input_target_account_id: "7331277089",
      });
      if (draftError) throw new Error("X 帖子已保存，但进入微博初审失败");
      imported++;
    }
    const { error: updateError } = await owner.supabase.from("x_read_connections")
      .update({
        x_user_id: userId, last_post_id: newestId || connection.last_post_id,
        last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("workspace_id", owner.workspaceId);
    if (updateError) throw new Error("同步位置保存失败；再次同步可能重复读取");
    return NextResponse.json({ imported, firstSync: !connection.last_post_id, readOnly: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const message = cause instanceof XApiError ? cause.message : cause instanceof Error
      ? ["无法确认 @Global_Funny_ 的 X 用户 ID", "X 返回部分读取错误，本轮不会更新同步位置",
          "本轮新帖超过 100 条，已停止以免遗漏或超出读取预算；请联系维护者处理",
          "X 帖子正文为空或超出工作站存储限制",
          "X_CREDENTIAL_ENCRYPTION_KEY 未配置", "X_CREDENTIAL_ENCRYPTION_KEY 格式无效"]
        .includes(cause.message) ? cause.message : "X 同步失败，请稍后重试"
      : "X 同步失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: cause instanceof XApiError ? cause.status : 500 });
  }
}
