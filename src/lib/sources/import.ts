import type { SourceDocument, SourceAnalysis, RepositoryResource } from "@/types/source";
import { SOURCE_CATEGORIES } from "@/types/source";

const text = (value: unknown, max = 30000): string => typeof value === "string" ? value.slice(0, max) : "";
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(v => typeof v === "string").slice(0, 20).map(v => v.slice(0, 3000)) : [];
const safeUrl = (value: unknown): string | undefined => {
  try { const url = new URL(String(value)); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined; } catch { return undefined; }
};

export function decodeSourceBundle(value: unknown): SourceDocument[] {
  const rows = Array.isArray(value) ? value : (value as { sources?: unknown })?.sources;
  if (!Array.isArray(rows) || rows.length > 1000 || rows.reduce((sum, row) => sum + (typeof row?.body === "string" ? row.body.length : 0), 0) > 8_000_000) throw new Error("请选择有效的素材库导出文件（最多 1000 份、800 万字）");
  return rows.map(row => {
    if (!row || typeof row !== "object" || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id) || !["x", "xiaohongshu", "douyin", "wechat", "weibo", "article"].includes(row.platform) || typeof row.body !== "string" || row.body.length > 120000) throw new Error("素材格式不正确，未导入任何内容");
    let analysis: SourceAnalysis | undefined;
    if (row.analysis) {
      const a = row.analysis;
      if (typeof a !== "object") throw new Error("素材摘要格式无效");
      if (!SOURCE_CATEGORIES.includes(a.category) || !text(a.summary)) throw new Error("素材分类或摘要格式无效");
      analysis = {
        category: a.category, summary: text(a.summary), tags: strings(a.tags), keyPoints: strings(a.keyPoints), cautions: strings(a.cautions),
        evidence: Array.isArray(a.evidence) ? a.evidence.filter((e: { quote?: unknown }) => typeof e?.quote === "string" && row.body.includes(e.quote)).slice(0, 20).map((e: { quote: string; kind: string }) => ({ quote: text(e.quote), kind: text(e.kind, 20), verification: "来源陈述，未独立核实" })) : [],
        segments: Array.isArray(a.segments) ? a.segments.filter((s: { start?: number; end?: number; part?: string }) => Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.start! >= 0 && s.end! > s.start! && ["开头", "中间", "结尾"].includes(s.part!)).slice(0, 20).map((s: { part: string; start: number; end: number; summary: string; technique: string }) => ({ part: s.part, start: s.start, end: s.end, summary: text(s.summary), technique: text(s.technique) })) : [],
        model: text(a.model, 80), generatedAt: text(a.generatedAt, 40),
      };
    }
    const repositories: RepositoryResource[] = Array.isArray(row.repositories) ? row.repositories.filter((r: { url?: string } | null) => { try { return new URL(r?.url!).hostname === "github.com" && !!safeUrl(r?.url); } catch { return false; } }).slice(0, 20).map((r: RepositoryResource) => ({ url: safeUrl(r.url)!, name: text(r.name, 200), purpose: text(r.purpose), license: text(r.license, 100), verified: r.verified === true })) : [];
    const now = new Date().toISOString();
    const book = row.book && typeof row.book === "object" && /^[a-z0-9-]{1,80}$/.test(row.book.id) && Number.isInteger(row.book.chapterNumber) && row.book.chapterNumber > 0 && Number.isInteger(row.book.itemNumber) && row.book.itemNumber > 0 && /^s\d+-\d+$/.test(row.book.anchor) && safeUrl(row.book.url) ? {
      id: row.book.id, title: text(row.book.title, 200), url: safeUrl(row.book.url)!,
      chapterNumber: row.book.chapterNumber, chapterTitle: text(row.book.chapterTitle, 200), chapterIntro: text(row.book.chapterIntro, 3000),
      itemNumber: row.book.itemNumber, anchor: row.book.anchor, grade: text(row.book.grade, 10), ratio: text(row.book.ratio, 30),
      lead: text(row.book.lead, 5000), references: Array.isArray(row.book.references) ? row.book.references.slice(0, 30).map((ref: { text?: unknown; urls?: unknown }) => ({ text: text(ref?.text, 4000), urls: Array.isArray(ref?.urls) ? ref.urls.map(safeUrl).filter((url: string | undefined): url is string => !!url).slice(0, 20) : [] })) : [],
    } : undefined;
    return {
      id: row.id, platform: row.platform, url: safeUrl(row.url), title: text(row.title, 300), body: row.body,
      coverage: ["full", "excerpt", "preview"].includes(row.coverage) ? row.coverage : "preview",
      captureMethod: ["public_page", "pasted_text", "link_only", "browser_cli", "local_asr"].includes(row.captureMethod) ? row.captureMethod : "pasted_text",
      status: ["collecting", "transcribing", "captured", "analyzing", "ready", "failed"].includes(row.status) ? row.status : undefined,
      error: text(row.error, 500), author: text(row.author, 200), analysis, repositories, book,
      createdAt: Number.isFinite(Date.parse(row.createdAt)) ? row.createdAt : now,
      updatedAt: Number.isFinite(Date.parse(row.updatedAt)) ? row.updatedAt : now,
      ...(row.transcript && Number.isFinite(row.transcript.duration) && Array.isArray(row.transcript.segments) ? { transcript: {
        text: row.body, duration: row.transcript.duration, engine: text(row.transcript.engine, 100), reviewRequired: true,
        segments: row.transcript.segments.filter((s: { start: number; end: number; text: string } | null) => !!s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && typeof s.text === "string").slice(0, 10000).map((s: { start: number; end: number; text: string }) => ({ start: s.start, end: s.end, text: text(s.text) }))
      } } : {}),
    };
  });
}
