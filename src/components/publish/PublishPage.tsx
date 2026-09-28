"use client";

import Link from "next/link";
import { useState } from "react";
import { useTopicsStore } from "@/store/topics-store";
import { useStyleStore } from "@/store/style-store";
import { useAiConfigStore } from "@/store/ai-config-store";
import { useHydrated } from "@/hooks/useHydrated";
import type { Platform, PublishItem, Topic } from "@/types/topic";
import { PLATFORMS } from "@/types/topic";
import { Sparkles, Upload, Send, ExternalLink, ChevronDown, ChevronUp, ArrowRight, Repeat2, Share2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

const PUBLISH_PLATFORMS: Platform[] = ["xhs", "douyin", "x", "wechat"];

// MCP 状态：暂无 → 显示配置提示
const MCP_STATUS: Record<Platform, "ready" | "none"> = {
  xhs: "none", douyin: "none", x: "none", wechat: "none",
};

function PlatformPanel({ topic, platform }: { topic: Topic; platform: Platform }) {
  const meta = PLATFORMS[platform];
  const setPublishItem = useTopicsStore((s) => s.setPublishItem);
  const profile = useStyleStore((s) => s.profile);
  const aiConfig = useAiConfigStore((s) => s.config);

  const existing: PublishItem = topic.publishItems?.find((p) => p.platform === platform) ?? { platform };
  const [title, setTitle] = useState(existing.title ?? "");
  const [tags, setTags] = useState((existing.tags ?? []).join(" "));
  const [coverUrl, setCoverUrl] = useState(existing.coverUrl ?? "");
  const [generating, setGenerating] = useState(false);
  const [genCover, setGenCover] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const generateMeta = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/studio/publish-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: topic.title, script: topic.script, platform, aiConfig }),
      });
      const data = (await res.json()) as { title?: string; tags?: string[]; coverPrompt?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `物料生成失败（HTTP ${res.status}）`);
      if (data.title) setTitle(data.title);
      if (data.tags) setTags(data.tags.join(" "));

      // 自动生成封面
      let nextCoverUrl = coverUrl;
      if (data.coverPrompt) {
        setGenCover(true);
        try {
          const coverRes = await fetch("/api/factory/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: data.coverPrompt,
              type: "hero",
              palette: "elegant",
              rendering: "digital",
              aspect: platform === "xhs" ? "1:1" : platform === "douyin" ? "9:16" : "16:9",
            }),
          });
          const coverData = (await coverRes.json()) as { url?: string; error?: string };
          if (!coverRes.ok || coverData.error || !coverData.url) {
            throw new Error(coverData.error || `封面生成失败（HTTP ${coverRes.status}）`);
          }
          nextCoverUrl = coverData.url;
          setCoverUrl(nextCoverUrl);
        } catch (e) {
          setGenError(e instanceof Error ? e.message : "封面生成失败");
        } finally {
          setGenCover(false);
        }
      }

      setPublishItem(topic.id, {
        platform,
        title: data.title ?? title,
        tags: data.tags ?? tags.split(/[\s,，]+/).filter(Boolean),
        coverUrl: nextCoverUrl,
      });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "物料生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const save = () => {
    setPublishItem(topic.id, {
      platform,
      title,
      tags: tags.split(/[\s,，]+/).filter(Boolean),
      coverUrl,
    });
  };

  const mcpStatus = MCP_STATUS[platform];

  return (
    <div className="rounded-[6px] border border-line bg-surface-2 p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-semibold" style={{ color: meta.fg, background: meta.bg }}>
          {meta.label}
        </span>
        <button
          type="button"
          onClick={generateMeta}
          disabled={generating || genCover}
          className="flex items-center gap-1 rounded-[5px] border border-terra-wash bg-terra-wash px-2.5 py-1 text-[11px] font-medium text-terra-deep transition enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white disabled:opacity-60"
        >
          <Sparkles className="h-3 w-3" />
          {genCover ? "生成封面…" : generating ? "生成中…" : "生成物料"}
        </button>
      </div>

      {genError && (
        <p className="mb-2.5 rounded-[5px] bg-red-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-700">
          {genError}
        </p>
      )}

      {/* Cover */}
      {coverUrl ? (
        <div className="mb-2.5 overflow-hidden rounded-[6px] border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="封面" className="w-full object-cover" style={{ maxHeight: 120 }} />
        </div>
      ) : (
        <div className="mb-2.5 flex h-[72px] items-center justify-center rounded-[6px] border border-dashed border-line bg-surface text-[11px] text-muted">
          {genCover ? "封面生成中…" : "封面 (生成后显示)"}
        </div>
      )}

      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        placeholder="发布标题…"
        className="mb-2 w-full rounded-[5px] border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-terra"
      />

      {/* Tags */}
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        onBlur={save}
        placeholder="#话题标签 空格分隔…"
        className="mb-2.5 w-full rounded-[5px] border border-line bg-surface px-2.5 py-1.5 text-[11.5px] text-ink-soft outline-none focus:border-terra"
      />

      {/* Publish button */}
      <button
        type="button"
        disabled={mcpStatus === "none"}
        title={mcpStatus === "none" ? "MCP 未配置，见侧边配置说明" : ""}
        className="flex w-full items-center justify-center gap-1.5 rounded-[5px] border px-3 py-1.5 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-muted enabled:border-terra enabled:bg-terra enabled:text-white enabled:hover:bg-terra-deep"
      >
        <Send className="h-3.5 w-3.5" />
        {mcpStatus === "none" ? `一键发布（待配置 MCP）` : `发布到 ${meta.label}`}
      </button>
    </div>
  );
}

function TopicPublishCard({ topic }: { topic: Topic }) {
  const updateTopic = useTopicsStore((s) => s.updateTopic);
  const [expanded, setExpanded] = useState(true);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    updateTopic(topic.id, { note: `${topic.note ?? ""} [视频:${file.name}]` });
  };

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-ink">{topic.title}</h3>
          {topic.script && (
            <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">
              {topic.script.slice(0, 80)}…
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Video upload */}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-ink-soft transition hover:border-terra hover:text-terra-deep">
            <Upload className="h-3.5 w-3.5" />
            上传视频
            <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
          </label>
          <button type="button" onClick={() => setExpanded((o) => !o)} className="text-muted hover:text-ink">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Script preview */}
      {expanded && topic.script && (
        <div className="border-t border-line px-5 py-3">
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted">口播稿预览</p>
          <pre className="max-h-[120px] overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-soft">
            {topic.script.slice(0, 500)}{topic.script.length > 500 ? "…" : ""}
          </pre>
        </div>
      )}

      {/* Platform panels */}
      {expanded && (
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-[11px] font-medium tracking-wide text-muted">各平台物料</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {PUBLISH_PLATFORMS.map((p) => (
              <PlatformPanel key={p} topic={topic} platform={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PublishPage() {
  const hydrated = useHydrated();
  const topics = useTopicsStore((s) => s.topics);
  const readyTopics = hydrated
    ? topics.filter((t) => t.stage === "ready" || t.stage === "assets")
    : [];

  return (
    <div className="max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 md:px-[38px] md:pt-9">
      <PageHeader eyebrow="发出去" title="多平台分发" sub="先选择内容从哪里来，再决定发到哪里、什么时候发。" />

      <div className="mb-7 grid gap-3 md:grid-cols-2">
        <Link href="/content" className="group rounded-[18px] border border-line bg-[#143f34] p-5 text-white shadow-card transition hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3"><Repeat2 size={20} /><ArrowRight size={17} className="transition group-hover:translate-x-1" /></div>
          <h2 className="mt-6 text-lg font-semibold">X 原创 → 微博</h2>
          <p className="mt-2 text-xs leading-6 text-white/65">自动读取 X 原文，人工初审后分时排期发布。</p>
        </Link>
        <div className="rounded-[18px] border border-line bg-[#e9f6f0] p-5 text-[#173f32] shadow-card">
          <Share2 size={20} />
          <h2 className="mt-6 text-lg font-semibold">成品 → 多平台</h2>
          <p className="mt-2 text-xs leading-6 text-[#4b6b5e]">为小红书、抖音、X、公众号生成各自的标题、标签和封面。</p>
        </div>
      </div>

      <div className="mb-4"><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">待处理</p><h2 className="mt-1 text-xl font-semibold">成品分发队列</h2></div>

      {/* MCP config notice */}
      <div className="mb-6 flex items-start gap-3 rounded-card border border-line bg-surface-2 px-4 py-3">
        <ExternalLink className="mt-0.5 h-4 w-4 flex-none text-terra" />
        <div className="text-[12.5px] text-ink-soft">
          <span className="font-medium text-ink">一键发布</span> 需要配置平台 MCP。当前为草稿模式，物料生成后可手动复制发布。
          <a href="/settings" className="ml-1 font-medium text-terra hover:underline">查看 MCP 配置说明 →</a>
        </div>
      </div>

      {readyTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line py-20 text-center text-muted">
          <Send className="h-8 w-8 opacity-30" />
          <p className="text-[14px]">暂无待发布选题</p>
          <p className="text-[12px]">在创作台将选题推进到「素材就绪」阶段后，会出现在这里</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {readyTopics.map((t) => (
            <TopicPublishCard key={t.id} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
}
