"use client";

import { useState } from "react";
import { Sparkles, Download, RotateCcw, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { useTopicsStore } from "@/store/topics-store";

// ── 维度配置（源自 baoyu-cover-image skill 的 5-dimension 体系）────────────────
const TYPES = [
  { key: "conceptual", label: "概念图" },
  { key: "hero", label: "主视觉" },
  { key: "typography", label: "字体流" },
  { key: "metaphor", label: "隐喻" },
  { key: "scene", label: "场景" },
  { key: "minimal", label: "极简" },
];

const PALETTES = [
  { key: "warm", label: "暖色", color: "#bf5b33" },
  { key: "earth", label: "大地", color: "#8B6914" },
  { key: "elegant", label: "典雅", color: "#7c8a6a" },
  { key: "cool", label: "冷色", color: "#4a7fa5" },
  { key: "dark", label: "深色", color: "#2b2622" },
  { key: "mono", label: "黑白", color: "#555" },
  { key: "vivid", label: "鲜艳", color: "#e63946" },
  { key: "pastel", label: "马卡龙", color: "#f4a1c3" },
  { key: "retro", label: "复古", color: "#c17f35" },
];

const RENDERINGS = [
  { key: "flat-vector", label: "扁平插画" },
  { key: "painterly", label: "绘画质感" },
  { key: "hand-drawn", label: "手绘" },
  { key: "digital", label: "数字艺术" },
  { key: "chalk", label: "粉笔" },
];

const ASPECTS = [
  { key: "16:9", label: "16:9 横版", hint: "公众号/B站" },
  { key: "1:1", label: "1:1 方形", hint: "小红书" },
  { key: "9:16", label: "9:16 竖版", hint: "抖音/朋友圈" },
];

// ── XHS 系列配图（源自 baoyu-xhs-images skill）────────────────────────────────
const XHS_STYLES = [
  { key: "warm", label: "温暖系" },
  { key: "fresh", label: "清新系" },
  { key: "minimal", label: "极简风" },
  { key: "bold", label: "大字报" },
  { key: "notion", label: "Notion 风" },
  { key: "retro", label: "复古杂志" },
];

interface GeneratedImage {
  id: string;
  url: string;
  title: string;
  aspect: string;
  prompt: string;
}

type Tab = "cover" | "xhs";

function DimButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition ${
        active
          ? "border-terra bg-terra text-white"
          : "border-line bg-surface text-ink-soft hover:border-terra hover:text-terra"
      }`}
    >
      {children}
    </button>
  );
}

export function FactoryPage() {
  const topics = useTopicsStore((s) => s.topics);
  const [tab, setTab] = useState<Tab>("cover");

  // Cover form state
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [type, setType] = useState("conceptual");
  const [palette, setPalette] = useState("warm");
  const [rendering, setRendering] = useState("flat-vector");
  const [aspect, setAspect] = useState("16:9");

  // XHS form state
  const [xhsTitle, setXhsTitle] = useState("");
  const [xhsStyle, setXhsStyle] = useState("warm");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);

  const activeTopics = topics.filter((t) => t.stage !== "published");

  const getTitle = () => {
    if (selectedTopicId) {
      return topics.find((t) => t.id === selectedTopicId)?.title ?? customTitle;
    }
    return customTitle;
  };

  const buildXhsPrompt = (title: string, style: string): string => {
    const styleMap: Record<string, string> = {
      warm: "warm cozy lifestyle, terracotta and cream",
      fresh: "fresh minimal, sage green and white, airy",
      minimal: "ultra-minimal, single element, lots of whitespace",
      bold: "bold typography, high contrast, impactful",
      notion: "clean Notion-style, organized layout, soft gray",
      retro: "retro magazine, vintage typography, muted tones",
    };
    return `xiaohongshu infographic cover, "${title.slice(0, 60)}", ${styleMap[style] ?? styleMap.warm}, no face, no person, decorative only, flat illustration, 1:1 format`;
  };

  const generate = async () => {
    const title = tab === "cover" ? getTitle() : xhsTitle;
    if (!title.trim()) {
      setError("请输入选题标题或自定义文案");
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const body =
        tab === "cover"
          ? { title, type, palette, rendering, aspect }
          : {
              title: buildXhsPrompt(xhsTitle, xhsStyle),
              type: "minimal",
              palette: xhsStyle === "warm" ? "warm" : xhsStyle === "fresh" ? "elegant" : "mono",
              rendering: "flat-vector",
              aspect: "1:1",
            };

      const res = await fetch("/api/factory/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { url?: string; prompt?: string; error?: string };

      if (!res.ok || json.error) {
        setError(json.error ?? "生成失败，请重试");
        return;
      }

      if (json.url) {
        setGallery((prev) => [
          {
            id: crypto.randomUUID(),
            url: json.url!,
            title,
            aspect: tab === "cover" ? aspect : "1:1",
            prompt: json.prompt ?? "",
          },
          ...prev,
        ]);
      }
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-[1180px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="FACTORY"
        title="素材工厂"
        sub="AI 生封面 · 小红书配图 · 产出物绑定选题卡片"
      />

      {/* Skill 来源说明 */}
      <div className="mb-8 flex items-start gap-2 rounded-[10px] border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
        <Info size={13} className="mt-0.5 flex-none text-terra opacity-70" />
        <span>
          生成逻辑参照{" "}
          <code className="rounded bg-surface-2 px-1 text-terra">baoyu-cover-image</code> 的
          5维度体系 + <code className="rounded bg-surface-2 px-1 text-terra">baoyu-xhs-images</code>
          的风格库，通过 DashScope 通义万象 API 生成。需在 .env.local 配置{" "}
          <code className="rounded bg-surface-2 px-1 text-ink-soft">DASHSCOPE_API_KEY</code>。
        </span>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-8">
        {/* ── 左：生成表单 ───────────────────────────── */}
        <div className="space-y-6">
          {/* Tab 切换 */}
          <div className="flex rounded-xl border border-line bg-surface p-1">
            {(["cover", "xhs"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-[13px] font-medium transition ${
                  tab === t
                    ? "bg-terra text-white shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {t === "cover" ? "封面图 (baoyu-cover)" : "小红书配图 (baoyu-xhs)"}
              </button>
            ))}
          </div>

          {tab === "cover" ? (
            <div className="space-y-5">
              {/* 选题绑定 */}
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                  绑定选题
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-terra focus:outline-none"
                >
                  <option value="">— 不绑定，手动输入 —</option>
                  {activeTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title.slice(0, 36)}{t.title.length > 36 ? "…" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedTopicId && (
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                    标题 / 关键词
                  </label>
                  <input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="例：AI Agent 让一人公司成为现实"
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-terra focus:outline-none"
                  />
                </div>
              )}

              {/* 类型 */}
              <div>
                <label className="mb-2 block text-[12.5px] font-medium text-ink-soft">图类型</label>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <DimButton key={t.key} active={type === t.key} onClick={() => setType(t.key)}>
                      {t.label}
                    </DimButton>
                  ))}
                </div>
              </div>

              {/* 配色 */}
              <div>
                <label className="mb-2 block text-[12.5px] font-medium text-ink-soft">配色</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPalette(p.key)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                        palette === p.key
                          ? "border-terra bg-terra text-white"
                          : "border-line bg-surface text-ink-soft hover:border-terra"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-none"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 渲染风格 */}
              <div>
                <label className="mb-2 block text-[12.5px] font-medium text-ink-soft">
                  渲染风格
                </label>
                <div className="flex flex-wrap gap-2">
                  {RENDERINGS.map((r) => (
                    <DimButton key={r.key} active={rendering === r.key} onClick={() => setRendering(r.key)}>
                      {r.label}
                    </DimButton>
                  ))}
                </div>
              </div>

              {/* 比例 */}
              <div>
                <label className="mb-2 block text-[12.5px] font-medium text-ink-soft">比例</label>
                <div className="flex gap-2">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setAspect(a.key)}
                      className={`flex-1 rounded-lg border py-2 text-center transition ${
                        aspect === a.key
                          ? "border-terra bg-terra text-white"
                          : "border-line bg-surface text-ink-soft hover:border-terra"
                      }`}
                    >
                      <div className="text-[12.5px] font-medium">{a.label}</div>
                      <div className="text-[11px] opacity-70">{a.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // XHS tab
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">
                  主题文案
                </label>
                <input
                  value={xhsTitle}
                  onChange={(e) => setXhsTitle(e.target.value)}
                  placeholder="例：5 个让你效率翻倍的 AI 工具"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-terra focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-[12.5px] font-medium text-ink-soft">
                  图片风格（baoyu-xhs-images 风格库）
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {XHS_STYLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setXhsStyle(s.key)}
                      className={`rounded-lg border py-2.5 text-[12.5px] font-medium transition ${
                        xhsStyle === s.key
                          ? "border-terra bg-terra text-white"
                          : "border-line bg-surface text-ink-soft hover:border-terra"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-muted">
                  生成 1:1 方形配图，适合小红书封面
                </p>
              </div>
            </div>
          )}

          {/* 生成按钮 */}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-terra py-3 text-[14px] font-semibold text-white transition hover:bg-terra-deep disabled:opacity-60"
          >
            <Sparkles size={15} className={generating ? "animate-pulse" : ""} />
            {generating ? "生成中，大约 20 秒…" : "生成素材"}
          </button>

          {generating && (
            <div className="rounded-lg border border-terra-wash bg-terra-wash px-4 py-3 text-[12.5px] text-terra-deep">
              DashScope 通义万象正在生成，请稍候（约 15–30 秒）…
            </div>
          )}
        </div>

        {/* ── 右：生成结果画廊 ──────────────────────── */}
        <div>
          <h3 className="mb-4 text-[13px] font-medium text-ink-soft">
            生成结果
            {gallery.length > 0 && (
              <button
                onClick={() => setGallery([])}
                className="ml-3 text-[12px] text-muted hover:text-terra"
              >
                <RotateCcw size={11} className="inline mr-0.5" />
                清空
              </button>
            )}
          </h3>

          {gallery.length === 0 && !generating && (
            <div className="flex h-[320px] items-center justify-center rounded-[14px] border-2 border-dashed border-line">
              <div className="text-center">
                <Sparkles size={28} className="mx-auto mb-2 text-muted opacity-40" />
                <p className="text-[13px] text-muted">点击「生成素材」后，图片出现在这里</p>
              </div>
            </div>
          )}

          {generating && gallery.length === 0 && (
            <div className="flex h-[320px] items-center justify-center rounded-[14px] border border-line bg-surface">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-terra border-t-transparent" />
                <p className="text-[13px] text-muted">通义万象生成中…</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {gallery.map((img) => (
              <div
                key={img.id}
                className="group overflow-hidden rounded-[14px] border border-line bg-surface shadow-card"
              >
                {/* 图片区 */}
                <div
                  className={`relative overflow-hidden bg-surface-2 ${
                    img.aspect === "9:16"
                      ? "aspect-[9/16]"
                      : img.aspect === "1:1"
                      ? "aspect-square"
                      : "aspect-video"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.title}
                    className="h-full w-full object-cover"
                  />
                  {/* 下载悬浮按钮 */}
                  <a
                    href={img.url}
                    download={`cover-${img.id.slice(0, 6)}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 opacity-0 shadow transition group-hover:opacity-100 hover:bg-white"
                  >
                    <Download size={13} className="text-ink" />
                  </a>
                </div>

                {/* 描述 */}
                <div className="p-3">
                  <p className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
                    {img.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted">{img.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
