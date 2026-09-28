import { NextResponse, type NextRequest } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  const { title, script, status } = input as { title?: unknown; script?: unknown; status?: unknown };
  if (typeof title !== "string" || !title.trim() || title.length > 180 ||
      typeof script !== "string" || !script.trim() || script.length > 20000 ||
      (status !== "draft" && status !== "ready")) {
    return NextResponse.json({ error: "标题、台词或状态无效" }, { status: 400 });
  }
  const { data, error } = await owner.supabase.from("video_briefs")
    .update({ title: title.trim(), script: script.trim(), status, updated_at: new Date().toISOString() })
    .eq("id", params.id).eq("workspace_id", owner.workspaceId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "保存拍摄稿失败" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "找不到拍摄稿" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
