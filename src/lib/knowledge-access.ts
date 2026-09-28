import { NextResponse } from "next/server";
import { localKnowledgeReadAllowed } from "@/lib/sources/local-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

export const knowledgeHeaders = { "Cache-Control": "private, no-store" };

/** Keep private files protected even when middleware has no auth configuration. */
export async function knowledgeReadDenial(request: { url: string; headers: Headers; method: string }) {
  if (localKnowledgeReadAllowed(request)) return null;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "请先登录工作站；本机请通过本地工作站启动入口访问。" }, { status: 401, headers: knowledgeHeaders });
  }
  try {
    const { data, error } = await createServerSupabase().auth.getClaims();
    if (error || !data?.claims?.sub) {
      return NextResponse.json({ error: "请先登录工作站" }, { status: 401, headers: knowledgeHeaders });
    }
    const expected = process.env.ZMT_OWNER_EMAIL?.trim().toLowerCase();
    if (!expected || typeof data.claims.email !== "string" || data.claims.email.toLowerCase() !== expected) {
      return NextResponse.json({ error: "此账号尚未获准读取知识库，请使用工作站所有者账号登录。" }, { status: 403, headers: knowledgeHeaders });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "暂时无法验证登录状态，请稍后重试。" }, { status: 503, headers: knowledgeHeaders });
  }
}
