import { NextResponse, type NextRequest } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

interface ScheduleItem { id?: unknown; scheduledAt?: unknown }

export async function POST(request: NextRequest) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "只有工作空间所有者能安排发布" }, { status: 403 });
  const { data: connection } = await owner.supabase.from("weibo_connections")
    .select("status,refresh_expires_at").eq("workspace_id", owner.workspaceId).maybeSingle();
  if (!connection || connection.status !== "active") return NextResponse.json({ error: "请先连接微博正式服务" }, { status: 409 });
  if (new Date(connection.refresh_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "微博长期授权已过期，请重新连接" }, { status: 409 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "排期格式无效" }, { status: 400 }); }
  const items = input && typeof input === "object" && Array.isArray((input as { items?: unknown }).items)
    ? (input as { items: ScheduleItem[] }).items : null;
  if (!items || items.length < 1 || items.length > 20) return NextResponse.json({ error: "一次请选择 1～20 条草稿" }, { status: 400 });
  const normalized = items.map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    scheduled_at: typeof item.scheduledAt === "string" ? item.scheduledAt : "",
  }));
  if (normalized.some((item) => !/^[0-9a-f-]{36}$/i.test(item.id) || Number.isNaN(Date.parse(item.scheduled_at)))) {
    return NextResponse.json({ error: "排期数据无效" }, { status: 400 });
  }
  if (new Set(normalized.map((item) => item.id)).size !== normalized.length) {
    return NextResponse.json({ error: "同一条草稿不能重复排期" }, { status: 400 });
  }
  const { data, error } = await owner.supabase.rpc("schedule_weibo_drafts", { input_items: normalized });
  if (error) return NextResponse.json({ error: error.message.includes("发布时间") ? error.message : "安排失败，草稿可能已变化，请刷新后重试" }, { status: 409 });
  return NextResponse.json({ scheduled: data, estimatedCredits: Number(data) * 15 });
}
