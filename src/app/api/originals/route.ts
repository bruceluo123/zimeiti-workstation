import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_WEIBO_UID, parseOwnXUrl } from "@/lib/content/original";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data, error } = await owner.supabase
    .from("mirror_drafts")
    .select("id,source_id,revision_id,body,status,target_account_id,published_url,created_at,updated_at,approved_at,scheduled_at,published_at,publish_attempts,last_error,ai_generated,content_sources!mirror_drafts_source_id_fkey(source_url,origin_platform)")
    .eq("workspace_id", owner.workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "读取草稿失败" }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  const { body, sourceUrl } = input as { body?: unknown; sourceUrl?: unknown };
  if (typeof body !== "string" || !body.trim() || body.length > 20000) return NextResponse.json({ error: "请填写 1～20000 字的原文" }, { status: 400 });
  if (sourceUrl !== undefined && typeof sourceUrl !== "string") return NextResponse.json({ error: "X 链接格式无效" }, { status: 400 });
  const parsed = sourceUrl ? parseOwnXUrl(sourceUrl) : null;
  if (sourceUrl && !parsed) return NextResponse.json({ error: "请填写 @Global_Funny_ 本人推文的链接" }, { status: 400 });
  const { data, error } = await owner.supabase.rpc("save_manual_original", {
    input_body: body,
    input_source_url: parsed?.url ?? null,
    input_external_id: parsed?.externalId ?? null,
    input_target_account_id: DEFAULT_WEIBO_UID,
  });
  if (error) return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  return NextResponse.json({ draftId: data }, { status: 201 });
}
