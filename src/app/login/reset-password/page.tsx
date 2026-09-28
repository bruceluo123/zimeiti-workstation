"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BrandMark } from "@/components/brand/BrandMark";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [complete, setComplete] = useState(false);
  const [sessionState, setSessionState] = useState<"checking" | "ready" | "missing">("checking");

  useEffect(() => {
    let active = true;
    createBrowserSupabase().auth.getUser().then(({ data, error }) => {
      if (active) setSessionState(!error && data.user ? "ready" : "missing");
    });
    return () => { active = false; };
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (sessionState !== "ready") {
      setMessage("请先登录工作站，再设置新密码。");
      return;
    }
    if (password.length < 12) {
      setMessage("密码至少需要 12 位，建议使用一段只有你知道的长短语。");
      return;
    }
    if (password !== confirmation) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    setWorking(true);
    const { error } = await createBrowserSupabase().auth.updateUser({ password });
    setWorking(false);
    if (error) {
      setMessage("密码设置失败，请确认当前登录状态后重试。");
      return;
    }
    setComplete(true);
    setPassword("");
    setConfirmation("");
  }

  return (
    <main className="mx-auto flex min-h-[78vh] max-w-md flex-col justify-center px-6 pb-20">
      <BrandMark className="mb-6 h-14 w-14" />
      <h1 className="text-3xl font-semibold">完成管理员账号设置</h1>
      <p className="mt-3 text-sm leading-6 text-ink-soft">为原管理员账号设置新密码，无需收取邮件。以后手机和电脑都能用邮箱与密码登录。</p>

      {sessionState === "checking" && <p className="mt-7 text-sm text-ink-soft">正在确认登录状态…</p>}
      {sessionState === "missing" && (
        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p>当前设备尚未登录，请先登录原管理员账号。</p>
          <a href="/login" className="mt-4 inline-block font-medium underline">返回登录页</a>
        </div>
      )}
      {sessionState === "ready" && (complete ? (
        <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-medium text-emerald-900">密码设置完成</p>
          <p className="mt-2 text-sm text-emerald-800">当前设备已经登录，可以直接进入工作站。</p>
          <a href="/" className="mt-5 block rounded-xl bg-terra px-4 py-3 text-center font-medium text-white">进入工作站</a>
        </div>
      ) : (
        <form onSubmit={updatePassword} className="mt-7 space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="new-password">新密码</label>
            <div className="relative mt-2">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-line bg-white py-3 pl-11 pr-12 outline-none focus:border-terra"
                placeholder="至少 12 位"
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

          <div>
            <label className="block text-sm font-medium" htmlFor="confirm-password">再次输入</label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-terra"
              placeholder="再次输入新密码"
            />
          </div>

          <p className="text-xs leading-5 text-ink-soft">请使用本站独有的密码，不要与邮箱、微博或 X 共用。</p>
          <button disabled={working} className="w-full rounded-xl bg-terra px-4 py-3 font-medium text-white disabled:opacity-60">
            {working ? "保存中…" : "保存密码"}
          </button>
        </form>
      ))}

      {message && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
    </main>
  );
}
