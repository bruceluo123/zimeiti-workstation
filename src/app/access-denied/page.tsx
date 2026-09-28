"use client";

import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function AccessDeniedPage() {
  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    window.location.href = "/login";
  }
  return (
    <main className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">暂时无法进入工作站</h1>
      <p className="mt-3 text-sm text-ink-soft">当前邮箱不是已配置的管理员账号，或管理员邮箱尚未设置。你的内容没有被读取或修改。</p>
      <button onClick={signOut} className="mt-6 w-fit rounded-xl bg-terra px-4 py-2.5 text-sm font-medium text-white">退出并更换邮箱</button>
    </main>
  );
}
