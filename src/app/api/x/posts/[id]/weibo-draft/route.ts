import { NextResponse } from "next/server";
import { getOwnerWorkspace } from "@/lib/auth/owner";
import { DEFAULT_WEIBO_UID } from "@/lib/content/original";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const owner = await getOwnerWorkspace();
  if (!owner) return NextResponse.json({ error: "请先登录专属工作空间" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) {
    return NextResponse.json({ error: "X 原文标识无效" }, { status: 400 });
  }
  const { data, error } = await owner.supabase.rpc("create_weibo_draft_from_source", {
    input_source_id: params.id,
    input_target_account_id: DEFAULT_WEIBO_UID,
  });
  if (error || !data) return NextResponse.json({ error: "生成微博草稿失败，请刷新后重试" }, { status: 500 });
  return NextResponse.json({ draftId: data }, { status: 201 });
}
