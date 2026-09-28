import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authEmailErrorResponse } from "@/lib/auth/email-error";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "登录服务尚未配置" }, { status: 503 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "请输入邮箱" }, { status: 400 }); }
  const email = input && typeof input === "object" && typeof (input as { email?: unknown }).email === "string"
    ? (input as { email: string }).email.trim().toLowerCase() : "";
  if (!email || email.length > 254) return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
  const ownerEmail = process.env.ZMT_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail) return NextResponse.json({ error: "管理员邮箱尚未配置" }, { status: 503 });
  if (email !== ownerEmail) return NextResponse.json({ ok: true });

  const siteUrl = process.env.ZMT_SITE_URL;
  if (!siteUrl) return NextResponse.json({ error: "登录回跳地址尚未配置" }, { status: 503 });
  const { error } = await createServerSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL("/auth/callback", siteUrl).toString(), shouldCreateUser: false },
  });
  if (error) return authEmailErrorResponse(error, "登录邮件暂时无法发送，请稍后再试");
  return NextResponse.json({ ok: true });
}
