"use client";

import { useState } from "react";
import { Archive, ArrowDown, Check, Clipboard, Link2, Loader2, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { useAiConfigStore } from "@/store/ai-config-store";
import { useResourcesStore } from "@/store/resources-store";
import { useHydrated } from "@/hooks/useHydrated";
import type { ResourceKind } from "@/types/resource";
import { parseSourceUrl, platformOf } from "@/lib/sources/platform";
import type { SourceDocument } from "@/types/source";

type SegmentType = "hook" | "pain" | "bridge" | "scene" | "proof" | "cta";

interface Analysis {
  summary: string;
  transferableCore: string;
  segments: { type: SegmentType; label: string; content: string; purpose: string; start?: number; end?: number }[];
  library: { hooks: string[]; painPoints: string[]; scenes: string[]; proofs: string[]; ctas: string[] };
  remake: { angle: string; opening: string; outline: string[]; originalityGuard: string };
}

const segmentColors: Record<SegmentType, string> = {
  hook: "bg-[#fff1d8] text-[#8b5712]",
  pain: "bg-[#ffe4e3] text-[#9b3432]",
  bridge: "bg-[#e6eefb] text-[#315c92]",
  scene: "bg-[#e7f4ea] text-[#347149]",
  proof: "bg-[#efe8fa] text-[#694b91]",
  cta: "bg-[#dff3ef] text-[#176a5a]",
};

interface SourceInfo { title: string; url: string; sourceId?: string; model: string; coverage: "transcript_and_frames" | "transcript_only" | "provided_text"; characters: number; frameCount: number; transcript?: string }
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

async function waitForVideo(sourceId: string, onProgress: (message: string) => void, notBefore: number): Promise<string> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
    const response = await fetch("/api/sources/library", { cache: "no-store" });
    if (!response.ok) throw new Error("无法读取本机视频采集进度");
    const data = await response.json() as { sources?: SourceDocument[] };
    const item = data.sources?.find((entry) => entry.id === sourceId);
    if (!item) { onProgress("正在连接抖音并下载视频…"); continue; }
    if (Date.parse(item.updatedAt) < notBefore - 1000) { onProgress("正在准备这条视频…"); continue; }
    if (item.status === "failed") throw new Error(item.error || "视频采集失败，请检查浏览器登录或上传视频文件");
    if (item.transcript?.segments?.length && ["captured", "ready"].includes(item.status || "")) return sourceId;
    onProgress(item.status === "transcribing" ? "已取得视频，正在识别逐句口播…" : "正在取得视频内容…");
  }
  throw new Error("视频处理时间过长，请到素材库查看采集状态后重试");
}

async function captureVideo(url: string, onProgress: (message: string) => void): Promise<string> {
  const startedAt = Date.now();
  const started = await fetch("/api/sources/library", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, captureOnly: true }),
  });
  const job = await started.json() as { sourceId?: string; error?: string };
  if (!started.ok || !job.sourceId) throw new Error(job.error || "视频采集未启动，请在本机 3002 工作站打开");
  return waitForVideo(job.sourceId, onProgress, startedAt);
}

async function uploadVideo(url: string, video: File, onProgress: (message: string) => void): Promise<string> {
  const startedAt = Date.now();
  const form = new FormData();
  form.set("url", url); form.set("video", video);
  onProgress("正在上传视频到本机工作站…");
  const started = await fetch("/api/deconstruct/upload", { method: "POST", body: form });
  const job = await started.json() as { sourceId?: string; error?: string };
  if (!started.ok || !job.sourceId) throw new Error(job.error || "视频上传失败");
  return waitForVideo(job.sourceId, onProgress, startedAt);
}

function LibraryColumn({ title, items, kind, onSave, isSaved }: { title: string; items: string[]; kind: ResourceKind; onSave: (item: string, kind: ResourceKind) => void; isSaved: (item: string, kind: ResourceKind) => boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs font-semibold text-ink">{title}</p>
      {items.length ? <ul className="mt-2 space-y-3 text-xs leading-5 text-ink-soft">{items.map((item, index) => <li key={`${item}-${index}`}><p>· {item}</p><button type="button" disabled={isSaved(item, kind)} onClick={() => onSave(item, kind)} className="mt-1 inline-flex min-h-8 items-center gap-1 text-[11px] font-medium text-terra disabled:text-muted">{isSaved(item, kind) ? <Check size={12} /> : <Archive size={12} />}{isSaved(item, kind) ? "已入库" : "存资源库"}</button></li>)}</ul> : <p className="mt-2 text-xs text-muted">原素材中没有明确出现</p>}
    </div>
  );
}

export function DeconstructPage() {
  const hydrated = useHydrated();
  const aiConfig = useAiConfigStore((state) => state.config);
  const addFromAnalysis = useResourcesStore((state) => state.addFromAnalysis);
  const storedResources = useResourcesStore((state) => state.resources);
  const resources = hydrated && Array.isArray(storedResources) ? storedResources : [];
  const [source, setSource] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("个人成长、AI 效率与无痛坚持自媒体");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  function savePiece(item: string, kind: ResourceKind) {
    addFromAnalysis({ body: item, kind, sourceUrl: sourceInfo?.url || undefined, sourceDocumentId: sourceInfo?.sourceId });
  }

  function isSaved(item: string, kind: ResourceKind) {
    return resources.some((resource) => resource.origin === "ai_analysis" && resource.body === item && resource.kind === kind && resource.sourceUrl === (sourceInfo?.url || undefined));
  }

  async function analyze() {
    if (!source.trim()) return;
    setWorking(true); setError(""); setNotice(""); setAnalysis(null); setSourceInfo(null);
    try {
      const parsed = parseSourceUrl(source);
      if (videoFile && (!parsed || platformOf(parsed) !== "douyin")) throw new Error("上传视频时请同时粘贴对应的抖音作品链接");
      const sourceId = videoFile && parsed ? await uploadVideo(parsed.toString(), videoFile, setNotice)
        : parsed && platformOf(parsed) === "douyin" ? await captureVideo(parsed.toString(), setNotice) : undefined;
      setNotice("素材已准备好，正在交给 AI 分析内容结构…");
      const response = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, sourceId, goal, aiConfig }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "拆解失败");
      setAnalysis(result.analysis);
      setSourceInfo(result.sourceInfo);
      setNotice("");
    } catch (cause) {
      setNotice("");
      setError(cause instanceof Error ? cause.message : "拆解失败");
    } finally { setWorking(false); }
  }

  async function copyRemake() {
    if (!analysis) return;
    const text = [`新切角：${analysis.remake.angle}`, `原创开场：${analysis.remake.opening}`, "内容顺序：", ...analysis.remake.outline.map((item, index) => `${index + 1}. ${item}`), `原创边界：${analysis.remake.originalityGuard}`].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-20 pt-6 sm:px-6 md:px-10 md:pt-9">
      <header className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[2px] text-terra">内容拆解</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-.8px] md:text-[42px]">看懂它为什么有效，<br className="hidden sm:block" />再做成你的内容。</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">借结构，不借原句。把外部素材拆成可复用的内容零件，再换成你的经历、观点和证据。</p>
        </div>
        <div className="rounded-2xl border border-[#cfe6dc] bg-[#edf8f3] p-4 text-xs leading-5 text-[#315e4d]">
          <ShieldCheck size={17} className="mb-2" />
          <b className="text-[#173f32]">原创护栏</b><br />不复制原句、不冒用案例、不补写原视频没有的事实。
        </div>
      </header>

      <section className="mt-7 overflow-hidden rounded-[22px] border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center gap-2"><Link2 size={17} className="text-terra" /><h2 className="font-semibold">丢进一条素材</h2></div>
          <p className="mt-1 text-xs text-muted">本机可从抖音链接下载视频并识别口播；口播文字会交给你配置的 AI，使用 DeepSeek Flash 时还会分析少量抽帧。文字素材请粘贴完整正文。</p>
        </div>
        <div className="p-5">
          <textarea value={source} onChange={(event) => setSource(event.target.value)} placeholder="例如：复制抖音里的完整分享文本、链接、视频字幕或口播稿……" className="min-h-[180px] w-full resize-y rounded-2xl border border-line bg-bg px-4 py-3 text-sm leading-7 outline-none transition focus:border-terra focus:bg-white focus:ring-4 focus:ring-terra-wash" />
          <label className="mt-3 block text-xs font-medium text-ink-soft">抖音限制链接读取时，上传同一条视频文件（可选）</label>
          <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border border-line bg-bg p-3 text-xs text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-terra-wash file:px-3 file:py-2 file:font-semibold file:text-terra" />
          {videoFile && <p className="mt-2 text-xs text-muted">已选 {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB。原视频留在本机；口播文字会发给 AI，使用 DeepSeek Flash 时也会发送少量抽帧。</p>}
          <label className="mt-4 block text-xs font-medium text-ink-soft">我想转成什么方向</label>
          <input value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-4 text-sm outline-none focus:border-terra" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">视频识别需要几分钟；没有取得口播就不会生成拆解。</p>
            <button onClick={analyze} disabled={working || !source.trim()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-terra px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terra-deep disabled:cursor-not-allowed disabled:opacity-45">
              {working ? <Loader2 size={17} className="animate-spin" /> : <ScanSearch size={17} />}{working ? "正在拆解…" : "开始拆解"}
            </button>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-[#cfe6dc] bg-[#edf8f3] px-4 py-3 text-sm text-[#315e4d]">{notice}</p>}

      {analysis && (
        <div className="mt-7 space-y-5 animate-fade-up">
          {sourceInfo && <section className="rounded-2xl border border-[#cfe6dc] bg-[#edf8f3] p-4 text-xs leading-6 text-[#315e4d]"><b>AI 实际分析材料：</b>{sourceInfo.coverage === "transcript_and_frames" ? `视频口播 ${sourceInfo.characters} 字 + ${sourceInfo.frameCount} 帧画面` : sourceInfo.coverage === "transcript_only" ? `视频口播 ${sourceInfo.characters} 字（画面未取得）` : `粘贴文字 ${sourceInfo.characters} 字`} · 模型 {sourceInfo.model}{sourceInfo.url && <a href={sourceInfo.url} target="_blank" rel="noreferrer" className="ml-2 underline">核对原视频 ↗</a>}{sourceInfo.transcript && <details className="mt-2"><summary className="cursor-pointer font-medium">查看用于拆解的口播转写</summary><p className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-ink-soft">{sourceInfo.transcript}</p></details>}</section>}
          <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-[#153e34] p-5 text-white"><p className="text-[11px] font-semibold tracking-[1.5px] text-white/60">一句话结论</p><p className="mt-3 text-lg font-semibold leading-8">{analysis.summary}</p></div>
            <div className="rounded-2xl border border-line bg-white p-5"><p className="text-[11px] font-semibold tracking-[1.5px] text-terra">可迁移的底层机制</p><p className="mt-3 text-sm leading-7 text-ink-soft">{analysis.transferableCore}</p></div>
          </section>

          <section className="rounded-[22px] border border-line bg-white p-5 md:p-6">
            <div className="flex items-center gap-2"><ArrowDown size={17} className="text-terra" /><h2 className="text-lg font-semibold">逐段拉片</h2></div>
            <div className="mt-5 space-y-3">
              {analysis.segments.map((segment, index) => (
                <div key={`${segment.type}-${index}`} className="grid gap-3 rounded-2xl border border-line bg-bg p-4 md:grid-cols-[92px_1fr_230px] md:items-start">
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${segmentColors[segment.type] ?? segmentColors.bridge}`}>{String(index + 1).padStart(2, "0")} · {segment.label}{segment.start !== undefined && segment.end !== undefined ? ` · ${time(segment.start)}–${time(segment.end)}` : ""}</span>
                  <p className="text-sm leading-6 text-ink">{segment.content}</p>
                  <p className="text-xs leading-5 text-muted">作用：{segment.purpose}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-terra" /><h2 className="text-lg font-semibold">拆出可入库的素材零件</h2></div>
            <p className="mb-3 text-xs text-muted">这些是 AI 根据来源提炼的结构和机制；入库后仍可回原视频核对。</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <LibraryColumn title="钩子" items={analysis.library.hooks} kind="钩子" onSave={savePiece} isSaved={isSaved} />
              <LibraryColumn title="痛点" items={analysis.library.painPoints} kind="痛点" onSave={savePiece} isSaved={isSaved} />
              <LibraryColumn title="场景" items={analysis.library.scenes} kind="场景" onSave={savePiece} isSaved={isSaved} />
              <LibraryColumn title="佐证" items={analysis.library.proofs} kind="佐证" onSave={savePiece} isSaved={isSaved} />
              <LibraryColumn title="行动" items={analysis.library.ctas} kind="行动" onSave={savePiece} isSaved={isSaved} />
            </div>
          </section>

          <section className="rounded-[22px] border border-[#efd7bd] bg-[#fff7ed] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold tracking-[1.5px] text-[#9a5b22]">转成你的原创</p><h2 className="mt-1 text-xl font-semibold">{analysis.remake.angle}</h2></div><button onClick={copyRemake} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e6c39e] bg-white px-3 py-2 text-xs font-semibold text-[#78491f]">{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "已复制" : "复制创作路线"}</button></div>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.4fr]">
              <div className="rounded-xl bg-white/75 p-4"><p className="text-xs font-semibold text-[#78491f]">原创开场</p><p className="mt-2 text-sm leading-6">{analysis.remake.opening}</p></div>
              <div className="rounded-xl bg-white/75 p-4"><p className="text-xs font-semibold text-[#78491f]">内容顺序</p><ol className="mt-2 space-y-2 text-sm leading-6">{analysis.remake.outline.map((item, index) => <li key={`${item}-${index}`}>{index + 1}. {item}</li>)}</ol></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#8b633f]">不能照搬：{analysis.remake.originalityGuard}</p>
          </section>
        </div>
      )}
    </div>
  );
}
