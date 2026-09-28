import { NextRequest, NextResponse } from "next/server";
import { loadKb, obsidianUri } from "@/lib/kb";
import { knowledgeHeaders, knowledgeReadDenial } from "@/lib/knowledge-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denial = await knowledgeReadDenial(req);
  if (denial) return denial;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "请选择一篇知识库文档。" }, { status: 400, headers: knowledgeHeaders });

  try {
    const { docs } = loadKb();
    const doc = docs.find((d) => d.id === id);
    if (!doc) return NextResponse.json({ error: "这篇文档不存在或已移动，请关闭面板并重新搜索。" }, { status: 404, headers: knowledgeHeaders });

    return NextResponse.json({
      id: doc.id,
      title: doc.title,
      tags: doc.tags,
      summary: doc.summary,
      kind: doc.kind,
      path: doc.path,
      outLinks: doc.outLinks,
      todos: doc.todos,
      content: doc.content,
      created: doc.created,
      updated: doc.updated,
      obsidianUri: obsidianUri(doc.path),
    }, { headers: knowledgeHeaders });
  } catch {
    return NextResponse.json({ error: "文档暂时无法读取，请确认知识库目录可访问后重试。" }, { status: 503, headers: knowledgeHeaders });
  }
}
