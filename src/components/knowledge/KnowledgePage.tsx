"use client";

import { useEffect, useState } from "react";
import { Network, LayoutGrid, Search as SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HubWall } from "./HubWall";
import { KbGraph } from "./KbGraph";
import { KbSearch } from "./KbSearch";
import { DocPanel } from "./DocPanel";

// ── 类型（镜像 API 返回）────────────────────────────────────────────────────
interface HubCard {
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

interface GraphEdge {
  source: string;
  target: string;
}

interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  summary: string;
  kind: string;
  path: string;
}

interface DocDetail {
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

interface KbData {
  hubCards: HubCard[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  searchIndex: SearchDoc[];
  stats: { total: number; hubs: number; sources: number; edges: number };
}

type Tab = "hubs" | "graph";

export function KnowledgePage() {
  const [data, setData] = useState<KbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("hubs");
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch("/api/kb")
      .then((r) => r.json() as Promise<KbData>)
      .then((d) => {
        setData(d);
        if (d.stats.total === 0) setEmpty(true);
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, []);

  const openDoc = async (id: string) => {
    setLoadingDoc(true);
    try {
      const res = await fetch(`/api/kb/doc?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const doc = (await res.json()) as DocDetail;
        setSelectedDoc(doc);
      }
    } finally {
      setLoadingDoc(false);
    }
  };

  return (
    <div className="max-w-[1280px] px-[38px] pb-16 pt-9">
      <PageHeader
        eyebrow="KNOWLEDGE"
        title="知识库"
        sub={
          data
            ? `${data.stats.hubs} 个枢纽 · ${data.stats.sources} 条素材 · ${data.stats.edges} 条双链`
            : "个人知识图谱"
        }
      />

      {/* 搜索栏（始终显示） */}
      <div className="mb-6 max-w-[480px]">
        <KbSearch
          docs={data?.searchIndex ?? []}
          onSelect={openDoc}
        />
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-[14px] bg-surface-2" />
          ))}
        </div>
      )}

      {empty && !loading && (
        <div className="rounded-[14px] border border-dashed border-line py-16 text-center">
          <p className="text-[14px] text-muted">知识库路径暂不可读</p>
          <p className="mt-1 text-[12.5px] text-muted">
            本地开发时确保 <code className="rounded bg-surface-2 px-1">D:\wiki\个人知识库\wiki\</code> 存在
          </p>
        </div>
      )}

      {data && data.stats.total > 0 && (
        <div className={`flex gap-6 ${selectedDoc ? "items-start" : ""}`}>
          {/* 左主区 */}
          <div className="flex-1 min-w-0">
            {/* Tab 切换 */}
            <div className="mb-5 flex gap-1 rounded-xl border border-line bg-surface p-1 w-fit">
              <button
                onClick={() => setTab("hubs")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${
                  tab === "hubs" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                <LayoutGrid size={14} />
                枢纽墙
              </button>
              <button
                onClick={() => setTab("graph")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition ${
                  tab === "graph" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Network size={14} />
                关系图
              </button>
            </div>

            {tab === "hubs" && (
              <HubWall hubs={data.hubCards} onSelect={openDoc} />
            )}

            {tab === "graph" && (
              <KbGraph
                nodes={data.graph.nodes}
                edges={data.graph.edges}
                onNodeClick={openDoc}
              />
            )}
          </div>

          {/* 右侧文档面板 */}
          {(selectedDoc || loadingDoc) && (
            <div className="w-[420px] flex-none sticky top-6" style={{ maxHeight: "calc(100vh - 80px)" }}>
              {loadingDoc ? (
                <div className="flex h-64 items-center justify-center rounded-[14px] border border-line bg-surface">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-terra border-t-transparent" />
                </div>
              ) : selectedDoc ? (
                <DocPanel doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
