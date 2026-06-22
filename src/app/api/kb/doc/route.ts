import { NextRequest, NextResponse } from "next/server";
import { loadKb, obsidianUri } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { docs } = loadKb();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

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
  });
}
