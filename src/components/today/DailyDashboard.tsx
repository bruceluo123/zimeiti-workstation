"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenText, Clapperboard, Send, Sparkles } from "lucide-react";

interface DraftSummary { status: string; body: string; id: string }
interface BriefSummary { id: string; title: string; status: string }

export function DailyDashboard() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [briefs, setBriefs] = useState<BriefSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/originals", { cache: "no-store" }), fetch("/api/video-briefs", { cache: "no-store" })])
      .then(async ([originalResponse, briefResponse]) => {
        if (!originalResponse.ok || !briefResponse.ok) throw new Error("今天的内容暂时读取失败，请刷新页面重试");
        return Promise.all([originalResponse.json(), briefResponse.json()]);
      })
      .then(([originalData, briefData]) => { if (active) { setDrafts(originalData.drafts ?? []); setBriefs(briefData.briefs ?? []); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pending = drafts.filter((draft) => draft.status === "draft" || draft.status === "needs_review");
  const handoff = drafts.filter((draft) => draft.status === "handoff_pending");
  return (
    <div className="mx-auto max-w-[1060px] px-5 pb-16 pt-8 md:px-10 md:pt-10">
      <p className="text-xs font-semibold tracking-[2px] text-terra">轻松日更</p>
      <h1 className="mt-1 text-[30px] font-semibold leading-tight md:text-4xl">今天，只做眼前这一步</h1>
      <p className="mt-3 text-sm text-ink-soft">继续在 X 写。工作站帮你留住原文和下一步，不催你制造一条视频。</p>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6 md:col-span-2">
          <div className="flex items-center gap-2 text-terra"><Send size={18} /><h2 className="text-lg font-semibold text-ink">微博待处理</h2></div>
          <p className="mt-2 text-sm text-ink-soft">{loading ? "正在读取…" : pending.length ? `${pending.length} 条原样草稿等你交接，目标账号 UID 7331277089。` : handoff.length ? `${handoff.length} 条已复制，等你补充微博发布链接。` : "暂无待处理草稿。手动过渡入口可以先存今天的原文。"}</p>
          {pending[0] && <p className="mt-4 line-clamp-2 whitespace-pre-wrap rounded-xl bg-bg p-4 text-sm">{pending[0].body}</p>}
          <Link href="/content" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-terra px-4 py-2 text-sm font-medium text-white">{pending.length ? "查看原样草稿" : "保存今天的原文"}<ArrowRight size={16} /></Link>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center gap-2 text-terra"><Sparkles size={18} /><h2 className="text-lg font-semibold text-ink">今天可以拍什么</h2></div>
          <p className="mt-2 min-h-16 text-sm text-ink-soft">推荐器还没接入真实 X 原创。没有可信建议时，这里会安静等着。</p>
          <Link href="/video" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-terra">自己挑一条拍 <ArrowRight size={15} /></Link>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center gap-2 text-terra"><Clapperboard size={18} /><h2 className="text-lg font-semibold text-ink">继续上次内容</h2></div>
          <p className="mt-2 min-h-16 text-sm text-ink-soft">{briefs.length ? `上次的拍摄稿《${briefs[0].title}》已存好，${briefs[0].status === "ready" ? "可以打开提词继续拍。" : "还可以改一改再拍。"}` : "还没有云端拍摄稿。想拍时，选一条自己的原文就能开始。"}</p>
          <Link href="/video" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-terra">{briefs.length ? "继续上次的稿" : "开始准备拍摄"} <ArrowRight size={15} /></Link>
        </section>
      </div>

      <Link href="/content" className="mt-5 flex min-h-14 items-center justify-between rounded-2xl border border-dashed border-terra/40 bg-terra-wash px-5 text-sm font-medium text-terra-deep"><span className="inline-flex items-center gap-2"><BookOpenText size={17} />随手存一条原文</span><ArrowRight size={16} /></Link>
    </div>
  );
}
