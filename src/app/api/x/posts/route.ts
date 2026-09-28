import { NextResponse } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data: sources, error } = await owner.supabase.from("content_sources")
    .select("id,external_id,source_url,published_at,created_at")
    .eq("workspace_id", owner.workspaceId).eq("origin_platform", "x").eq("ownership", "mine")
    .order("published_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "X 帖子读取失败" }, { status: 500 });
  const ids = (sources ?? []).map((source) => source.id);
  if (!ids.length) return NextResponse.json({ posts: [] }, { headers: { "Cache-Control": "no-store" } });
  const { data: revisions, error: revisionsError } = await owner.supabase.from("content_revisions")
    .select("source_id,body,media,created_at").eq("workspace_id", owner.workspaceId)
    .in("source_id", ids).order("created_at", { ascending: false });
  if (revisionsError) return NextResponse.json({ error: "X 帖子正文读取失败" }, { status: 500 });
  const { data: drafts, error: draftsError } = await owner.supabase.from("mirror_drafts")
    .select("source_id,status").eq("workspace_id", owner.workspaceId)
    .eq("target_platform", "weibo").in("source_id", ids);
  if (draftsError) return NextResponse.json({ error: "微博草稿状态读取失败" }, { status: 500 });
  const draftBySource = new Map((drafts ?? []).map((draft) => [draft.source_id, draft.status]));
  const latest = new Map<string, { body: string; media: unknown }>();
  for (const revision of revisions ?? []) if (!latest.has(revision.source_id)) {
    latest.set(revision.source_id, { body: revision.body, media: revision.media });
  }
  return NextResponse.json({ posts: (sources ?? []).map((source) => ({
    ...source, body: latest.get(source.id)?.body ?? "", media: latest.get(source.id)?.media ?? [],
    weiboDraftStatus: draftBySource.get(source.id) ?? null,
  })) }, { headers: { "Cache-Control": "no-store" } });
}
