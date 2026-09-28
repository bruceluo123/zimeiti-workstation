import { NextResponse, type NextRequest } from "next/server";
import { chatComplete, hasApiKey } from "@/lib/ai";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

interface GeneratedBrief { title: string; script: string; shooting_notes: string; review_notes: string }

function parseBrief(raw: string): GeneratedBrief {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("拍摄稿格式不完整，请重试");
  const value: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!value || typeof value !== "object") throw new Error("拍摄稿格式不完整，请重试");
  const brief = value as Partial<GeneratedBrief>;
  if (typeof brief.title !== "string" || !brief.title.trim() || brief.title.length > 180 ||
      typeof brief.script !== "string" || !brief.script.trim() || brief.script.length > 20000 ||
      typeof brief.shooting_notes !== "string" || typeof brief.review_notes !== "string") {
    throw new Error("拍摄稿字段不完整，请重试");
  }
  return { title: brief.title.trim(), script: brief.script.trim(), shooting_notes: brief.shooting_notes.trim(), review_notes: brief.review_notes.trim() };
}

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  const { data, error } = await owner.supabase.from("video_briefs")
    .select("id,source_id,revision_id,title,script,shooting_notes,review_notes,status,created_at,updated_at")
    .eq("workspace_id", owner.workspaceId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "读取拍摄稿失败" }, { status: 500 });
  return NextResponse.json({ briefs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  const sourceId = input && typeof input === "object" && "sourceId" in input ? input.sourceId : null;
  const revisionId = input && typeof input === "object" && "revisionId" in input ? input.revisionId : null;
  if (typeof sourceId !== "string" || !/^[0-9a-f-]{36}$/i.test(sourceId) ||
      typeof revisionId !== "string" || !/^[0-9a-f-]{36}$/i.test(revisionId)) {
    return NextResponse.json({ error: "请选择一条明确版本的本人原创" }, { status: 400 });
  }

  const { data: source, error: sourceError } = await owner.supabase.from("content_sources")
    .select("id,ownership").eq("id", sourceId).eq("workspace_id", owner.workspaceId).single();
  if (sourceError || !source || source.ownership !== "mine") return NextResponse.json({ error: "只能基于自己的原创生成拍摄稿" }, { status: 404 });
  const { data: revision, error: revisionError } = await owner.supabase.from("content_revisions")
    .select("id,body").eq("id", revisionId).eq("source_id", sourceId).eq("workspace_id", owner.workspaceId).single();
  if (revisionError || !revision) return NextResponse.json({ error: "找不到原文版本" }, { status: 404 });

  const existing = await owner.supabase.from("video_briefs").select("id")
    .eq("workspace_id", owner.workspaceId).eq("source_id", sourceId).eq("revision_id", revision.id).maybeSingle();
  if (existing.error) return NextResponse.json({ error: "检查已有拍摄稿失败" }, { status: 500 });
  if (existing.data) return NextResponse.json({ id: existing.data.id, alreadyExists: true });
  if (!hasApiKey()) return NextResponse.json({ error: "管理员尚未配置拍摄稿生成服务" }, { status: 503 });

  try {
    const raw = await chatComplete([
      { role: "system", content: "你是创作者的口播编辑。只使用给定的本人原文，不虚构亲身经历、数据、来源、产品效果或他人引言。原文信息不足时保持短稿，并把需创作者补充的内容写到 review_notes，不能写成已证实的台词。保留创作者直接、自然的语气，不强行加关注或带货话术。只返回一个合法 JSON 对象，不要代码块，键为 title、script、shooting_notes、review_notes，值都是字符串。script 是约 30–60 秒能顺口念的中文纯文本，分段换行，不含舞台说明。shooting_notes 只写最少的场景或演示建议。" },
      { role: "user", content: `请把以下本人原创改成可直接用手机录制的短视频拍摄初稿。原文如下：\n<original>\n${revision.body.slice(0, 12000)}\n</original>` },
    ], { temperature: 0.45, maxTokens: 1400 });
    const brief = parseBrief(raw);
    const { data, error } = await owner.supabase.from("video_briefs").insert({
      workspace_id: owner.workspaceId, source_id: sourceId, revision_id: revision.id,
      title: brief.title, script: brief.script, shooting_notes: brief.shooting_notes,
      review_notes: brief.review_notes,
    }).select("id").single();
    if (error?.code === "23505") {
      const concurrent = await owner.supabase.from("video_briefs").select("id")
        .eq("workspace_id", owner.workspaceId).eq("source_id", sourceId).eq("revision_id", revision.id).single();
      if (concurrent.data) return NextResponse.json({ id: concurrent.data.id, alreadyExists: true });
    }
    if (error || !data) return NextResponse.json({ error: "拍摄稿生成成功，但保存失败，请重试" }, { status: 500 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && cause.message.startsWith("拍摄稿格式")
      ? cause.message : "拍摄稿生成失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
