import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localCaptureAllowed, localDevelopmentApiAllowed, localKnowledgeReadAllowed } from "@/lib/sources/local-access";

export async function middleware(request: NextRequest) {
  // Cron routes authenticate with a dedicated bearer secret inside the route.
  // They must bypass browser-session checks because Vercel has no user cookie.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (localKnowledgeReadAllowed(request)) return NextResponse.next();
  if (path.startsWith("/api/assistant") && localCaptureAllowed(request)) return NextResponse.next();
  if ((path === "/api/sources/library" || path === "/api/sources/quick") && localCaptureAllowed(request)) return NextResponse.next();
  if ((path === "/api/factory/image" || path === "/api/deconstruct" || path === "/api/deconstruct/upload") && localDevelopmentApiAllowed(request)) return NextResponse.next();
  const authRequired = process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED === "true";
  // During development, pages are directly accessible. API routes remain protected
  // so unfinished write operations and paid integrations are not exposed publicly.
  if (!authRequired && !path.startsWith("/api/")) return NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const publicApi = path === "/api/auth/start" || path === "/api/auth/recover" || path === "/api/inspire" || path === "/api/sources/extract";
  if (!signedIn && path !== "/login" && !publicApi && !path.startsWith("/auth/")) {
    if (path.startsWith("/api/")) {
      const denied = NextResponse.json({ error: "请先登录工作站" }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
      return denied;
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  const expectedEmail = process.env.ZMT_OWNER_EMAIL?.trim().toLowerCase();
  const actualEmail = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : "";
  if (signedIn && (!expectedEmail || actualEmail !== expectedEmail)) {
    if (path === "/access-denied") return response;
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "此账号尚未获准使用工作站" }, { status: 403 });
    }
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/access-denied";
    deniedUrl.search = "";
    const redirect = NextResponse.redirect(deniedUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  if (signedIn && path === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    const redirect = NextResponse.redirect(homeUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
