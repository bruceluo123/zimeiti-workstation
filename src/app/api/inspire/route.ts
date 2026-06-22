import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { InspireCategory, InspireItem, InspireResponse } from "@/types/inspire";

const AIHOT_BASE = process.env.ZMT_AIHOT_BASE ?? "https://aihot.virxact.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 zmt-workstation/1.0";

const VALID_CATEGORIES: InspireCategory[] = ["ai-models", "ai-products", "industry", "paper", "tip"];

interface AihotItem {
  id?: string;
  title?: string;
  title_en?: string | null;
  url?: string;
  source?: string;
  publishedAt?: string | null;
  summary?: string | null;
  category?: string | null;
  score?: number | null;
}

function normalizeCategory(raw: string | null | undefined): InspireCategory | null {
  if (raw && (VALID_CATEGORIES as string[]).includes(raw)) return raw as InspireCategory;
  return null;
}

function toInspireItem(it: AihotItem, src: "ai"): InspireItem | null {
  if (!it?.id || !it?.title || !it?.url) return null;
  return {
    id: it.id,
    source: src,
    title: it.title,
    summary: it.summary ?? "",
    url: it.url,
    sourceName: it.source ?? "AI HOT",
    category: normalizeCategory(it.category),
    publishedAt: it.publishedAt ?? null,
    score: typeof it.score === "number" ? it.score : null,
  };
}

// 精选（热榜）
async function fetchAihotSelected(): Promise<InspireItem[]> {
  const url = `${AIHOT_BASE}/api/public/items?mode=selected&take=30`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`aihot selected ${res.status}`);
  const json = (await res.json()) as { items?: AihotItem[] };
  return (Array.isArray(json.items) ? json.items : [])
    .map((it) => toInspireItem(it, "ai"))
    .filter((x): x is InspireItem => x !== null);
}

// 今日日报
async function fetchAihotDaily(): Promise<InspireItem[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const url = `${AIHOT_BASE}/api/public/daily?date=${today}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 600 } });
  if (!res.ok) return []; // 日报可能当天尚未生成，静默降级
  const json = (await res.json()) as { items?: AihotItem[]; data?: AihotItem[] };
  const raw = json.items ?? json.data ?? [];
  return (Array.isArray(raw) ? raw : [])
    .map((it) => toInspireItem(it, "ai"))
    .filter((x): x is InspireItem => x !== null);
}

// X 推文：由每日脚本写入 data/x-feed.json
async function readXFeed(): Promise<InspireItem[]> {
  try {
    const file = path.join(process.cwd(), "data", "x-feed.json");
    const raw = await fs.readFile(file, "utf-8");
    const arr = JSON.parse(raw) as Partial<InspireItem>[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((it) => it.id && it.title && it.url)
      .map((it) => ({
        id: String(it.id),
        source: "x" as const,
        title: String(it.title),
        summary: it.summary ?? "",
        url: String(it.url),
        sourceName: it.sourceName ?? "X",
        category: null,
        publishedAt: it.publishedAt ?? null,
        score: typeof it.score === "number" ? it.score : null,
      }));
  } catch {
    return [];
  }
}

export async function GET() {
  const [selectedResult, dailyResult, x] = await Promise.all([
    fetchAihotSelected().catch(() => null),
    fetchAihotDaily().catch(() => []),
    readXFeed(),
  ]);

  const body: InspireResponse = {
    success: selectedResult !== null,
    ai: selectedResult ?? [],
    daily: dailyResult,
    x,
    fetchedAt: new Date().toISOString(),
    error: selectedResult === null ? "aihot 精选拉取失败，稍后重试" : undefined,
  };
  return NextResponse.json(body);
}
