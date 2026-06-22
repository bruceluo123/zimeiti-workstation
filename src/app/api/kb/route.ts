import { NextResponse } from "next/server";
import { loadKb, buildSearchIndex, obsidianUri } from "@/lib/kb";

export const dynamic = "force-dynamic"; // 每次请求都重新读文件（dev 热更新）

export async function GET() {
  const { docs, graph, hubs } = loadKb();

  // 枢纽卡片：含 todos + outLinks 数量
  const hubCards = hubs.map((h) => ({
    id: h.id,
    title: h.title,
    tags: h.tags,
    summary: h.summary,
    path: h.path,
    outLinkCount: h.outLinks.length,
    todos: h.todos,
    obsidianUri: obsidianUri(h.path),
  }));

  // 搜索索引
  const searchIndex = buildSearchIndex(docs);

  return NextResponse.json({
    hubCards,
    graph,
    searchIndex,
    stats: {
      total: docs.length,
      hubs: hubs.length,
      sources: docs.filter((d) => d.kind === "source").length,
      edges: graph.edges.length,
    },
  });
}
