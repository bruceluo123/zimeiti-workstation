"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, Lightbulb, PenLine, ScanSearch, Share2, Sparkles } from "lucide-react";
import { useThoughtsStore } from "@/store/thoughts-store";
import { useHydrated } from "@/hooks/useHydrated";
import { QuickCapture } from "@/components/assistant/QuickCapture";

const coreModules = [
  {
    number: "01",
    eyebrow: "发出去",
    title: "多平台分发",
    description: "一份内容，整理成各平台能直接使用的版本。先初审，再排期，不让自动化替你做决定。",
    href: "/publish",
    action: "进入分发台",
    secondaryHref: "/content",
    secondary: "X → 微博",
    icon: Share2,
    className: "bg-[#123f34] text-white",
    mutedClass: "text-white/70",
    chipClass: "border-white/15 bg-white/10 text-white/80",
  },
  {
    number: "02",
    eyebrow: "收进来",
    title: "灵感随笔",
    description: "刚冒出的想法，按天随手记下。长期资料单独存入资源库，让 Codex 帮你提炼成可复用的知识。",
    href: "/inspire",
    action: "打开灵感库",
    icon: Lightbulb,
    className: "bg-[#e8f5d7] text-[#17351f]",
    mutedClass: "text-[#44604a]",
    chipClass: "border-[#17351f]/10 bg-white/55 text-[#36523d]",
  },
  {
    number: "03",
    eyebrow: "拆明白",
    title: "内容拆解",
    description: "粘贴抖音分享内容，拆出钩子、痛点、场景、佐证和行动，再转成属于你的原创表达。",
    href: "/deconstruct",
    action: "开始拆一条",
    icon: ScanSearch,
    className: "bg-[#ffe9d5] text-[#4a2b16]",
    mutedClass: "text-[#76543c]",
    chipClass: "border-[#4a2b16]/10 bg-white/55 text-[#67452d]",
  },
] as const;

export function CommandHome() {
  const thoughts = useThoughtsStore((state) => state.thoughts);
  const hydrated = useHydrated();

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-6 sm:px-6 md:px-9 md:pt-9">
      <header className="mb-6 grid gap-5 border-b border-line pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[11px] font-semibold tracking-[1.6px] text-terra-deep">
            <Sparkles size={13} /> 无痛坚持自媒体
          </div>
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.08] tracking-[-1.4px] text-ink sm:text-[42px] md:text-[52px]">
            收进来，拆明白，<span className="text-terra">发出去。</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-soft md:text-[15px]">不从复杂流程开始。今天只选一个入口，把眼前这一步做完。</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <BookMarked size={15} className="text-terra" />
          本机已收下 <b className="text-ink">{hydrated ? thoughts.length : "—"}</b> 条灵感
        </div>
      </header>

      <Link href="/assistant" className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-terra/25 bg-terra-wash px-5 py-4 text-terra-deep"><span><b className="block text-base">AI 工作台 · 本机 Codex</b><span className="mt-1 block text-xs">上传资料，带着创作背景讨论，确认后沉淀进知识库。</span></span><ArrowRight size={20}/></Link>

      <section aria-label="三大核心功能" className="grid gap-3 lg:grid-cols-3">
        {coreModules.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`group relative min-h-[270px] overflow-hidden rounded-[22px] p-5 shadow-[0_18px_45px_-30px_rgba(23,23,25,.38)] transition-transform duration-300 hover:-translate-y-1 md:p-6 ${item.className}`}>
              <div className="absolute -right-8 -top-10 text-[132px] font-bold leading-none opacity-[0.055]">{item.number}</div>
              <div className="relative flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${item.chipClass}`}>{item.number} · {item.eyebrow}</span>
                  <Icon size={22} strokeWidth={1.7} />
                </div>
                <h2 className="mt-8 text-[25px] font-semibold tracking-[-.5px]">{item.title}</h2>
                <p className={`mt-3 text-[13px] leading-6 ${item.mutedClass}`}>{item.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
                  <Link href={item.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#173b31] shadow-sm transition group-hover:gap-3">
                    {item.action}<ArrowRight size={15} />
                  </Link>
                  {"secondaryHref" in item && (
                    <Link href={item.secondaryHref} className="text-xs font-medium text-white/75 hover:text-white">{item.secondary} →</Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <Link href="/write" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#cde4d8] bg-[#f0f8f3] px-5 py-4 text-[#173f32] transition hover:border-terra">
        <span className="flex items-center gap-3"><PenLine size={20} /><span><b className="block text-sm">看到一篇好内容？边查边写</b><small className="block text-xs text-[#5d7668]">链接或原文入库，摘录出处，在同一屏写推特草稿</small></span></span>
        <ArrowRight size={17} />
      </Link>

      <div className="mt-4"><QuickCapture compact /></div>
      <p className="mt-2 text-right text-xs text-muted">这是刚冒出的原创想法？<Link href="/inspire" className="ml-1 text-terra underline">写进灵感随笔</Link></p>
    </div>
  );
}
