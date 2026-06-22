import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { InspireCategory, InspireItem, InspireResponse } from "@/types/inspire";

// aihot 公开 API：/api/public/* 走 nginx UA 黑名单，必须带浏览器 UA，否则 403。
const AIHOT_BASE = "https://aihot.virxact.com";
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

function toInspireItem(it: AihotItem): InspireItem | null {
  if (!it?.id || !it?.title || !it?.url) return null;
  return {
    id: it.id,
    source: "ai",
    title: it.title,
    summary: it.summary ?? "",
    url: it.url,
    sourceName: it.source ?? "AI HOT",
    category: normalizeCategory(it.category),
    publishedAt: it.publishedAt ?? null,
    score: typeof it.score === "number" ? it.score : null,
  };
}

async function fetchAihot(): Promise<InspireItem[]> {
  const url = `${AIHOT_BASE}/api/public/items?mode=selected&take=30`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 300 }, // 与 aihot 服务端 5 分钟缓存对齐
  });
  if (!res.ok) throw new Error(`aihot ${res.status}`);
  const json = (await res.json()) as { items?: AihotItem[] };
  const items = Array.isArray(json.items) ? json.items : [];
  return items.map(toInspireItem).filter((x): x is InspireItem => x !== null);
}

// agent-reach（X 抓取）是 CLI skill，无法在 serverless 运行时直接调用。
// 约定：skill 把抓到的推文写到 data/x-feed.json，本路由优雅读取；文件不存在则返回空。
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
  const [aiResult, x] = await Promise.all([
    fetchAihot().catch(() => null),
    readXFeed(),
  ]);

  if (aiResult === null) {
    const body: InspireResponse = {
      success: false,
      ai: [],
      x,
      fetchedAt: new Date().toISOString(),
      error: "aihot 拉取失败（网络或上游限流），稍后重试",
    };
    return NextResponse.json(body, { status: 200 });
  }

  const body: InspireResponse = {
    success: true,
    ai: aiResult,
    x,
    fetchedAt: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
