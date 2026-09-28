import { NextResponse } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";
import { decryptWeiboSecret, encryptWeiboSecret } from "@/lib/weibo/credential";
import { getWeiboUser, pollWeiboDeviceAuthorization, WeiboCliError } from "@/lib/weibo/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data: pending, error } = await owner.supabase.from("weibo_device_authorizations")
    .select("device_code_ciphertext,expires_at")
    .eq("workspace_id", owner.workspaceId).maybeSingle();
  if (error || !pending) return NextResponse.json({ error: "没有等待确认的微博授权" }, { status: 400 });
  if (new Date(pending.expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "微博授权码已过期，请重新连接" }, { status: 410 });
  try {
    const deviceCode = decryptWeiboSecret(pending.device_code_ciphertext, "device");
    const tokens = await pollWeiboDeviceAuthorization(deviceCode);
    const profile = await getWeiboUser(tokens.accessToken);
    const now = Date.now();
    const { error: saveError } = await owner.supabase.from("weibo_connections").upsert({
      workspace_id: owner.workspaceId,
      access_token_ciphertext: encryptWeiboSecret(tokens.accessToken, "access"),
      refresh_token_ciphertext: encryptWeiboSecret(tokens.refreshToken, "refresh"),
      access_expires_at: new Date(now + tokens.expiresIn * 1000).toISOString(),
      refresh_expires_at: new Date(now + tokens.refreshExpiresIn * 1000).toISOString(),
      weibo_user_id: profile.userId,
      username: profile.username,
      status: "active",
      connected_at: new Date(now).toISOString(),
      last_verified_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    });
    if (saveError) throw new Error("保存微博连接失败");
    await owner.supabase.from("weibo_device_authorizations").delete().eq("workspace_id", owner.workspaceId);
    return NextResponse.json({ connected: true, connection: { weibo_user_id: profile.userId, username: profile.username, status: "active" } });
  } catch (cause) {
    if (cause instanceof WeiboCliError && ["authorization_pending", "slow_down"].includes(cause.code)) {
      return NextResponse.json({ pending: true, code: cause.code }, { status: 202 });
    }
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "微博授权确认失败" }, { status: 502 });
  }
}
