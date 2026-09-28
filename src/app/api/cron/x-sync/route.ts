import { NextResponse, type NextRequest } from "next/server";
import { automationSecret, cronAuthorized } from "@/lib/automation/secret";
import { createAutomationSupabase } from "@/lib/supabase/automation";
import { decryptToken } from "@/lib/x/credential";
import { fullPostText, lookupOwnXUser, readOwnXPosts, XApiError } from "@/lib/x/client";
import { publishDueWeiboDrafts } from "@/lib/weibo/publish-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const secret = automationSecret();
  const supabase = createAutomationSupabase();
  const { data, error } = await supabase.rpc("automation_get_x_connection", { input_secret: secret });
  const connection = Array.isArray(data) ? data[0] : null;
  if (error || !connection) return NextResponse.json({ error: "X connection unavailable" }, { status: 503 });
  const lastSyncAt = connection.last_synced_at ? Date.parse(connection.last_synced_at) : null;
  if (connection.last_synced_at && !Number.isFinite(lastSyncAt)) {
    return NextResponse.json({ error: "Invalid X sync timestamp" }, { status: 503 });
  }
  const syncAgeMs = lastSyncAt === null ? null : Date.now() - lastSyncAt;
  if (syncAgeMs !== null && syncAgeMs < 29 * 60_000) {
    return NextResponse.json({ skipped: true, reason: "recently_synced", ageMinutes: Math.floor(syncAgeMs / 60_000), checkedAt: new Date().toISOString(), lastSyncedAt: connection.last_synced_at });
  }
  try {
    const token = decryptToken(connection.token_ciphertext);
    const userId = connection.x_user_id || await lookupOwnXUser(token);
    const { posts, newestId } = await readOwnXPosts(token, userId, connection.last_post_id || undefined);
    const payload = posts.slice().reverse().map((post) => ({
      id: post.id,
      body: fullPostText(post),
      created_at: post.created_at || null,
      media: (post.attachments?.media_keys || []).map((mediaKey) => ({ media_key: mediaKey })),
    }));
    const { data: imported, error: saveError } = await supabase.rpc("automation_save_x_posts", {
      input_secret: secret,
      input_workspace_id: connection.workspace_id,
      input_user_id: userId,
      input_newest_id: newestId,
      input_posts: payload,
    });
    if (saveError) throw new Error("save failed");
    let publishResults: Array<{ id: string; status: string }> = [];
    let publishError: string | null = null;
    if (Number(imported) > 0) {
      try { publishResults = await publishDueWeiboDrafts(secret); }
      catch { publishError = "微博发布队列暂时不可用；新帖仍已保存，待发布任务重试"; }
    }
    return NextResponse.json({ imported: Number(imported) || 0, newestId: newestId || null, publishResults, publishError, previousSyncAgeMinutes: syncAgeMs === null ? null : Math.floor(syncAgeMs / 60_000), checkedAt: new Date().toISOString(), lastSyncedAt: connection.last_synced_at });
  } catch (cause) {
    const message = cause instanceof XApiError ? cause.message : "X automatic sync failed";
    return NextResponse.json({ error: message }, { status: cause instanceof XApiError ? cause.status : 500 });
  }
}
