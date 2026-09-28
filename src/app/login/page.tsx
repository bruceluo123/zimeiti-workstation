"use client";

import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BrandMark } from "@/components/brand/BrandMark";

type Notice = { text: string } | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [working, setWorking] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured() || working) return;
    setWorking(true);
    setNotice(null);

    const { error } = await createBrowserSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setNotice({ text: "邮箱或密码不正确，请检查后重试。" });
      setWorking(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="mx-auto flex min-h-[78vh] max-w-md flex-col justify-center px-6 pb-20">
      <BrandMark className="mb-6 h-14 w-14" />
      <h1 className="text-3xl font-semibold">登录麦满分工作站</h1>
      <p className="mt-3 text-sm text-ink-soft">使用管理员邮箱和密码登录，手机和电脑共用同一账号。</p>

      {!isSupabaseConfigured() ? (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">独立数据库尚未配置，暂时不能登录。</p>
      ) : (
        <>
          <form onSubmit={signIn} className="mt-7 space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="login-email">邮箱</label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-line bg-white py-3 pl-11 pr-4 outline-none focus:border-terra"
                  placeholder="你的邮箱地址"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="login-password">密码</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-line bg-white py-3 pl-11 pr-12 outline-none focus:border-terra"
                  placeholder="输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 rounded-lg p-2 text-ink-soft transition hover:bg-black/5 hover:text-ink"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              disabled={working}
              className="w-full rounded-xl bg-terra px-4 py-3 font-medium text-white disabled:opacity-60"
            >
              {working ? "登录中…" : "登录工作站"}
            </button>
          </form>
          <a href="/login/reset-password" className="mt-4 block text-center text-sm text-terra underline">已登录？设置或更换密码</a>
        </>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {notice.text}
        </p>
      )}
    </main>
  );
}
