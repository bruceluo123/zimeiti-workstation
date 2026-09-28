import { NextResponse } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";
import { encryptWeiboSecret } from "@/lib/weibo/credential";
import { startWeiboDeviceAuthorization } from "@/lib/weibo/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const [{ data: connection }, { data: pending }] = await Promise.all([
    owner.supabase.from("weibo_connections")
      .select("weibo_user_id,username,status,connected_at,last_verified_at,refresh_expires_at")
      .eq("workspace_id", owner.workspaceId).maybeSingle(),
    owner.supabase.from("weibo_device_authorizations")
      .select("user_code,verification_uri,poll_interval_seconds,expires_at")
      .eq("workspace_id", owner.workspaceId).gt("expires_at", new Date().toISOString()).maybeSingle(),
  ]);
  const authorization = pending ? {
    userCode: pending.user_code,
    verificationUrl: `${pending.verification_uri}?user_code=${encodeURIComponent(pending.user_code)}`,
    interval: pending.poll_interval_seconds,
    expiresAt: pending.expires_at,
  } : null;
  return NextResponse.json({ connected: Boolean(connection?.status === "active"), connection, authorization }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "只有工作空间所有者能连接微博" }, { status: 403 });
  try {
    const authorization = await startWeiboDeviceAuthorization();
    const expiresAt = new Date(Date.now() + authorization.expiresIn * 1000).toISOString();
    const { error } = await owner.supabase.from("weibo_device_authorizations").upsert({
      workspace_id: owner.workspaceId,
      device_code_ciphertext: encryptWeiboSecret(authorization.deviceCode, "device"),
      user_code: authorization.userCode,
      verification_uri: authorization.verificationUri,
      poll_interval_seconds: authorization.interval,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error("保存微博授权进度失败");
    return NextResponse.json({
      userCode: authorization.userCode,
      verificationUrl: authorization.verificationUrl,
      interval: authorization.interval,
      expiresAt,
    });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "微博授权入口暂时不可用" }, { status: 502 });
  }
}

export async function DELETE() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "只有工作空间所有者能断开微博" }, { status: 403 });
  const now = new Date().toISOString();
  const { error } = await owner.supabase.from("weibo_connections")
    .update({ status: "revoked", updated_at: now }).eq("workspace_id", owner.workspaceId);
  if (error) return NextResponse.json({ error: "断开微博失败" }, { status: 500 });
  return NextResponse.json({ connected: false });
}
