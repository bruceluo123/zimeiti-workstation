"use client";

import { useState } from "react";
import { useTopicsStore } from "@/store/topics-store";
import { useStyleStore } from "@/store/style-store";
import { useHydrated } from "@/hooks/useHydrated";
import type { Platform, PublishItem, Topic } from "@/types/topic";
import { PLATFORMS } from "@/types/topic";
import { Sparkles, Upload, Send, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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

  const existing: PublishItem = topic.publishItems?.find((p) => p.platform === platform) ?? { platform };
  const [title, setTitle] = useState(existing.title ?? "");
  const [tags, setTags] = useState((existing.tags ?? []).join(" "));
  const [coverUrl, setCoverUrl] = useState(existing.coverUrl ?? "");
  const [generating, setGenerating] = useState(false);
  const [genCover, setGenCover] = useState(false);

  const generateMeta = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/studio/publish-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: topic.title, script: topic.script, platform }),
      });
      const data = (await res.json()) as { title?: string; tags?: string[]; coverPrompt?: string; error?: string };
      if (data.title) setTitle(data.title);
      if (data.tags) setTags(data.tags.join(" "));

      // 自动生成封面
      if (data.coverPrompt) {
        setGenCover(true);
        try {
          const coverRes = await fetch("/api/factory/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: data.coverPrompt,
              type: "text-overlay",
              palette: "neutral",
              rendering: "photography",
              aspect: platform === "xhs" ? "3:4" : platform === "douyin" ? "9:16" : "16:9",
            }),
          });
          const coverData = (await coverRes.json()) as { url?: string };
          if (coverData.url) setCoverUrl(coverData.url);
        } catch { /* cover gen failed silently */ }
        setGenCover(false);
      }

      setPublishItem(topic.id, {
        platform,
        title: data.title ?? title,
        tags: data.tags ?? [],
        coverUrl,
      });
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
          {generating ? "生成中…" : genCover ? "生成封面…" : "生成物料"}
        </button>
      </div>

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
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader eyebrow="发布箱" title="待发布选题" sub="物料生成与一键分发" />

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
