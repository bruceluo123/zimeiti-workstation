import { NextResponse, type NextRequest } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";
import { credentialReady, encryptToken } from "@/lib/x/credential";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data, error } = await owner.supabase.from("x_read_connections")
    .select("x_user_id,last_post_id,last_synced_at")
    .eq("workspace_id", owner.workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: "连接状态读取失败" }, { status: 500 });
  return NextResponse.json({
    connected: Boolean(data), ready: credentialReady(),
    lastSyncedAt: data?.last_synced_at ?? null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  if (!credentialReady()) return NextResponse.json({ error: "服务器尚未配置 X 连接加密密钥" }, { status: 503 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  const token = typeof input === "object" && input !== null && "bearerToken" in input
    ? (input as { bearerToken: unknown }).bearerToken : null;
  if (typeof token !== "string" || token.length < 20 || token.length > 500 || /\s/.test(token)) {
    return NextResponse.json({ error: "请填写新生成的 Bearer Token（不要填写 Consumer Secret）" }, { status: 400 });
  }
  const { error } = await owner.supabase.from("x_read_connections").upsert({
    workspace_id: owner.workspaceId,
    token_ciphertext: encryptToken(token),
    x_user_id: null,
    last_post_id: null,
    last_synced_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "workspace_id" });
  if (error) return NextResponse.json({ error: "保存 X 连接失败" }, { status: 500 });
  return NextResponse.json({ connected: true }, { headers: { "Cache-Control": "no-store" } });
}
