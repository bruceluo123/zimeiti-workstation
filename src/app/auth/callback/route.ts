import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  const recovery = request.nextUrl.searchParams.get("mode") === "recovery";
  if (!isSupabaseConfigured() || !code) return NextResponse.redirect(`${origin}/login?error=missing_code`);
  const supabase = createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  return NextResponse.redirect(`${origin}${recovery ? "/login/reset-password" : "/"}`);
}
