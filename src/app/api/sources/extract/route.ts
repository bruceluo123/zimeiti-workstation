import { NextRequest, NextResponse } from "next/server";
import { extractPublicSource } from "@/lib/sources/extract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "仅支持从工作站页面使用" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 4096) return NextResponse.json({ error: "链接过长" }, { status: 413 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  const url = typeof raw === "object" && raw !== null && "url" in raw ? (raw as { url: unknown }).url : null;
  if (typeof url !== "string" || url.length > 2048) return NextResponse.json({ error: "请提供一个链接" }, { status: 400 });
  try {
    return NextResponse.json(await extractPublicSource(url), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "读取失败，请粘贴原文" }, { status: 422 });
  }
}
