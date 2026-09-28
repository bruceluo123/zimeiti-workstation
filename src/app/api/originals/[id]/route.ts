import { NextResponse, type NextRequest } from "next/server";
import { parseWeiboPostUrl } from "@/lib/content/original";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "只有工作空间所有者能确认发布" }, { status: 403 });
  const { supabase, workspaceId } = owner;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  const action = input && typeof input === "object" ? (input as { action?: unknown }).action : null;
  const now = new Date().toISOString();
  if (action === "edit") {
    const body = input && typeof input === "object" ? (input as { body?: unknown }).body : null;
    if (typeof body !== "string" || !body.trim() || body.length > 20000) return NextResponse.json({ error: "正文须为 1～20000 字" }, { status: 400 });
    const { data, error } = await supabase.from("mirror_drafts")
      .update({ body, manually_edited: true, status: "draft", last_error: null, updated_at: now })
      .eq("id", params.id).eq("workspace_id", workspaceId).in("status", ["draft", "needs_review", "approved", "failed"])
      .select("id,status,body").maybeSingle();
    if (error) return NextResponse.json({ error: "保存修改失败" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "这条内容当前不能修改，请先取消排期" }, { status: 409 });
    return NextResponse.json({ draft: data });
  }
  if (action === "unschedule") {
    const { data, error } = await supabase.from("mirror_drafts")
      .update({ status: "draft", scheduled_at: null, schedule_batch_id: null, last_error: null, updated_at: now })
      .eq("id", params.id).eq("workspace_id", workspaceId).eq("status", "scheduled")
      .select("id,status").maybeSingle();
    if (error) return NextResponse.json({ error: "取消排期失败" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "内容可能已经进入发布，请刷新确认" }, { status: 409 });
    return NextResponse.json({ draft: data });
  }
  if (action === "handoff") {
    const { data, error } = await supabase.from("mirror_drafts")
      .update({ status: "handoff_pending", confirmed_at: now, updated_at: now })
      .eq("id", params.id).eq("workspace_id", workspaceId).in("status", ["draft", "needs_review"])
      .select("id,status").maybeSingle();
    if (error) return NextResponse.json({ error: "更新状态失败" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "草稿已变化，请刷新后再确认" }, { status: 409 });
    return NextResponse.json({ draft: data });
  }
  if (action === "reported_published") {
    const url = input && typeof input === "object" ? (input as { publishedUrl?: unknown }).publishedUrl : null;
    const validUrl = typeof url === "string" ? parseWeiboPostUrl(url) : null;
    if (!validUrl) return NextResponse.json({ error: "请填写微博帖子链接" }, { status: 400 });
    const { data, error } = await supabase.from("mirror_drafts")
      .update({ status: "reported_published", published_url: validUrl, updated_at: now })
      .eq("id", params.id).eq("workspace_id", workspaceId).eq("status", "handoff_pending")
      .select("id,status,published_url").maybeSingle();
    if (error) return NextResponse.json({ error: "更新状态失败" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "请先完成手动交接" }, { status: 409 });
    return NextResponse.json({ draft: data });
  }
  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}
