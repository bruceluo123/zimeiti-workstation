// 知识库数据层
// 运行在 Node.js（API route / build），不在浏览器。
// 扫描 D:\wiki\个人知识库\wiki\ → 解析 frontmatter + [[]] 双链 → 产出 graph + docs + hubs

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// ── 路径配置 ─────────────────────────────────────────────────────────────────
export const WIKI_ROOT = path.resolve("D:/wiki/个人知识库/wiki");
const HUB_DIR = path.join(WIKI_ROOT, "知识枢纽");

// ── 类型 ──────────────────────────────────────────────────────────────────────
export interface KbDoc {
  id: string;          // basename（无 .md）
  title: string;
  path: string;        // 相对 WIKI_ROOT 的路径，如 "知识枢纽/MOC_知识总图"
  absPath: string;     // 绝对路径
  tags: string[];
  created: string;
  updated: string;
  kind: "hub" | "source" | "topic" | "entity" | "other";
  summary: string;     // 首段摘要（≤120字）
  outLinks: string[];  // [[]] 目标 basename 列表
  todos: string[];     // "- [ ]" 待办项（MOC 的 OUT 钩子）
  content: string;     // 原始 markdown 正文
}

export interface KbNode {
  id: string;
  label: string;
  kind: KbDoc["kind"];
  linkCount: number;   // 入度 + 出度
}

export interface KbEdge {
  source: string;
  target: string;
}

export interface KbGraph {
  nodes: KbNode[];
  edges: KbEdge[];
}

// ── 工具 ──────────────────────────────────────────────────────────────────────
const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

function extractLinks(content: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(content)) !== null) {
    // 取 basename，去掉目录前缀和 .md 后缀
    const target = m[1].trim().replace(/\.md$/, "");
    const base = target.includes("/") ? target.split("/").pop()! : target;
    if (base) links.push(base);
  }
  return links;
}

function extractTodos(content: string): string[] {
  return content
    .split("\n")
    .filter((l) => /^- \[ \]/.test(l))
    .map((l) => l.replace(/^- \[ \]\s*/, "").trim());
}

function extractSummary(content: string): string {
  // 跳过 frontmatter 后的第一段非空、非标题文本
  const lines = content.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith(">") || t.startsWith("---") || t.startsWith("|")) continue;
    return t.replace(WIKILINK_RE, (_, id, alias) => alias ?? id).slice(0, 120);
  }
  return "";
}

function kindFromPath(rel: string): KbDoc["kind"] {
  if (rel.startsWith("知识枢纽")) return "hub";
  if (rel.startsWith("素材摘录")) return "source";
  if (rel.startsWith("主题词条")) return "topic";
  if (rel.startsWith("人物实体")) return "entity";
  return "other";
}

function readDoc(absPath: string): KbDoc | null {
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const { data, content } = matter(raw);
    const rel = path.relative(WIKI_ROOT, absPath).replace(/\\/g, "/").replace(/\.md$/, "");
    const id = path.basename(rel);
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    return {
      id,
      title: data.title ?? id.replace(/_/g, " "),
      path: rel,
      absPath,
      tags,
      created: data.created ?? "",
      updated: data.updated ?? "",
      kind: kindFromPath(rel),
      summary: extractSummary(content),
      outLinks: extractLinks(content),
      todos: extractTodos(content),
      content,
    };
  } catch {
    return null;
  }
}

function walkDir(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

let _cache: { docs: KbDoc[]; graph: KbGraph; hubs: KbDoc[] } | null = null;

export function loadKb(): { docs: KbDoc[]; graph: KbGraph; hubs: KbDoc[] } {
  if (_cache) return _cache;

  if (!fs.existsSync(WIKI_ROOT)) {
    // Vercel 等环境读不到本地盘，返回空
    return { docs: [], graph: { nodes: [], edges: [] }, hubs: [] };
  }

  const allPaths = walkDir(WIKI_ROOT);
  const docs = allPaths.map(readDoc).filter((d): d is KbDoc => d !== null);

  // 建 id → doc 的反查表
  const byId = new Map<string, KbDoc>(docs.map((d) => [d.id, d]));

  // 计算入度
  const inDegree = new Map<string, number>();
  for (const d of docs) {
    for (const t of d.outLinks) {
      inDegree.set(t, (inDegree.get(t) ?? 0) + 1);
    }
  }

  const nodes: KbNode[] = docs.map((d) => ({
    id: d.id,
    label: d.title || d.id,
    kind: d.kind,
    linkCount: d.outLinks.length + (inDegree.get(d.id) ?? 0),
  }));

  const edgeSet = new Set<string>();
  const edges: KbEdge[] = [];
  for (const d of docs) {
    for (const t of d.outLinks) {
      if (!byId.has(t)) continue;             // 只连已知节点
      const key = [d.id, t].sort().join("→"); // 去重，无向
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: d.id, target: t });
      }
    }
  }

  const hubs = docs
    .filter((d) => d.kind === "hub")
    .sort((a, b) => a.id.localeCompare(b.id));

  _cache = { docs, graph: { nodes, edges }, hubs };
  return _cache;
}

/** 清缓存（dev 热更新用）*/
export function clearKbCache() {
  _cache = null;
}

/** 给 MiniSearch 用的轻量索引 */
export function buildSearchIndex(docs: KbDoc[]) {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    tags: d.tags.join(" "),
    summary: d.summary,
    kind: d.kind,
    path: d.path,
  }));
}

/** obsidian:// URI */
export function obsidianUri(docPath: string): string {
  // docPath 是相对 WIKI_ROOT 的路径，如 "知识枢纽/MOC_AI变现与超级个体"
  return `obsidian://open?vault=%E4%B8%AA%E4%BA%BA%E7%9F%A5%E8%AF%86%E5%BA%93&file=${encodeURIComponent("wiki/" + docPath)}`;
}
