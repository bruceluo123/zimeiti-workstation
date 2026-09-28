export interface HubCard {
  id: string;
  title: string;
  tags: string[];
  summary: string;
  path: string;
  outLinkCount: number;
  todos: string[];
  obsidianUri: string;
}

interface GraphNode {
  id: string;
  label: string;
  kind: "hub" | "source" | "topic" | "entity" | "other";
  linkCount: number;
}

interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  summary: string;
  kind: string;
  path: string;
}

export interface DocDetail {
  id: string;
  title: string;
  tags: string[];
  summary: string;
  kind: string;
  path: string;
  outLinks: string[];
  todos: string[];
  content: string;
  created: string;
  updated: string;
  obsidianUri: string;
}

export interface KbData {
  hubCards: HubCard[];
  graph: { nodes: GraphNode[]; edges: { source: string; target: string }[] };
  searchIndex: SearchDoc[];
  stats: { total: number; hubs: number; sources: number; edges: number };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function stringFields(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => typeof value[field] === "string");
}

function count(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isKbData(value: unknown): value is KbData {
  if (!record(value) || !record(value.stats) || !record(value.graph)) return false;
  const { stats, graph } = value;
  return [stats.total, stats.hubs, stats.sources, stats.edges].every(count)
    && Array.isArray(value.hubCards) && value.hubCards.every((hub) => record(hub)
      && stringFields(hub, ["id", "title", "summary", "path", "obsidianUri"])
      && strings(hub.tags) && strings(hub.todos) && count(hub.outLinkCount))
    && Array.isArray(graph.nodes) && graph.nodes.every((node) => record(node)
      && stringFields(node, ["id", "label", "kind"]) && count(node.linkCount)
      && ["hub", "source", "topic", "entity", "other"].includes(node.kind as string))
    && Array.isArray(graph.edges) && graph.edges.every((edge) => record(edge) && stringFields(edge, ["source", "target"]))
    && Array.isArray(value.searchIndex) && value.searchIndex.every((doc) => record(doc)
      && stringFields(doc, ["id", "title", "tags", "summary", "kind", "path"]))
    && new Set(value.searchIndex.map((doc) => doc.id)).size === value.searchIndex.length;
}

export function isDocDetail(value: unknown): value is DocDetail {
  return record(value)
    && stringFields(value, ["id", "title", "summary", "kind", "path", "content", "created", "updated", "obsidianUri"])
    && strings(value.tags) && strings(value.outLinks) && strings(value.todos);
}

export function wikiLinkId(href: string): string | null {
  try {
    return decodeURIComponent(href.slice("?wiki=".length)) || null;
  } catch {
    return null;
  }
}

export class KnowledgeRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function readKnowledgeResponse<T>(response: Response, validate: (value: unknown) => value is T): Promise<T> {
  let value: unknown;
  try { value = await response.json(); } catch { /* Preserve HTTP status even for HTML error responses. */ }
  if (!response.ok) {
    const fallback = response.status === 401 ? "请先登录工作站后重试。" : response.status === 403
      ? "此账号尚未获准读取知识库，请使用工作站所有者账号登录。" : "知识库请求失败，请稍后重试。";
    throw new KnowledgeRequestError(record(value) && typeof value.error === "string" ? value.error : fallback, response.status);
  }
  if (!validate(value)) throw new KnowledgeRequestError("知识库返回的数据不完整，请重试；若仍失败，请检查知识库文件格式及是否存在重名文档。", response.status);
  return value;
}
