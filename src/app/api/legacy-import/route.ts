import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LegacyItem {
  kind: "thought" | "topic";
  payload: Record<string, unknown>;
}

function isLegacyItem(value: unknown): value is LegacyItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LegacyItem>;
  if (item.kind !== "thought" && item.kind !== "topic") return false;
  if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) return false;
  return typeof item.payload.id === "string" && item.payload.id.length > 0 && item.payload.id.length <= 150;
}

export async function GET() {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录管理员账号" }, { status: 401 });
  const { data, error } = await owner.supabase.from("legacy_items")
    .select("kind,legacy_id,payload,imported_at")
    .eq("workspace_id", owner.workspaceId)
    .order("imported_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "读取旧内容备份失败" }, { status: 500 });
  return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录管理员账号" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "单次导入最多 1 MB" }, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return NextResponse.json({ error: "导入文件格式无效" }, { status: 400 }); }
  const items = input && typeof input === "object" ? (input as { items?: unknown }).items : null;
  if (!Array.isArray(items) || items.length > 300 || !items.every(isLegacyItem)) return NextResponse.json({ error: "一次最多导入 300 条有效旧内容" }, { status: 400 });

  const rows = items.map((item) => {
    const encoded = JSON.stringify(item.payload);
    return {
      workspace_id: owner.workspaceId,
      kind: item.kind,
      legacy_id: item.payload.id as string,
      origin: "browser",
      content_hash: createHash("sha256").update(encoded).digest("hex"),
      payload: item.payload,
    };
  });
  for (let offset = 0; offset < rows.length; offset += 50) {
    const { error } = await owner.supabase.from("legacy_items")
      .upsert(rows.slice(offset, offset + 50), {
        onConflict: "workspace_id,kind,legacy_id,content_hash", ignoreDuplicates: true,
      });
    if (error) return NextResponse.json({ error: "导入中断，已经写入的部分不会丢失；请直接重试" }, { status: 500 });
  }
  return NextResponse.json({ accepted: rows.length, message: "旧内容已备份；重复导入不会产生副本" });
}
