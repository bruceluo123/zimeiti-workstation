"use client";

import { useEffect, useState } from "react";
import { Network, LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HubWall } from "./HubWall";
import { KbGraph } from "./KbGraph";
import { KbSearch } from "./KbSearch";
import { DocPanel } from "./DocPanel";
import { isKbData, isDocDetail, readKnowledgeResponse, KnowledgeRequestError, type KbData, type DocDetail } from "./response";

type Tab = "hubs" | "graph";

function ReadError({ error, onRetry, onClose }: { error: Error; onRetry: () => void; onClose?: () => void }) {
  const needsLogin = error instanceof KnowledgeRequestError && (error.status === 401 || error.status === 403);
  return (
    <div role="alert" className="rounded-[14px] border border-line bg-surface p-6">
      <p className="text-[14px] font-semibold text-ink">暂时无法读取知识库</p>
      <p className="mt-2 text-[13px] text-ink-soft">{error.message}</p>
      <div className="mt-4 flex gap-3 text-[13px]">
        <button type="button" onClick={onRetry} className="rounded-lg bg-terra px-3 py-2 text-white">重试读取</button>
        {needsLogin && <a href="/login" className="rounded-lg border border-line px-3 py-2 text-terra">前往登录</a>}
        {onClose && <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2">关闭面板</button>}
      </div>
    </div>
  );
}

export function KnowledgePage() {
  const [data, setData] = useState<KbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("hubs");
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reload, setReload] = useState(0);
  const [docError, setDocError] = useState<Error | null>(null);
  const [requestedDocId, setRequestedDocId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch("/api/kb", { signal: controller.signal, cache: "no-store" })
      .then((response) => readKnowledgeResponse(response, isKbData))
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(cause instanceof KnowledgeRequestError ? cause : new Error("无法连接工作站，请确认本机服务已启动后重试。"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const openDoc = async (id: string) => {
    if (loadingDoc) return;
    setLoadingDoc(true);
    setDocError(null);
    setSelectedDoc(null);
    setRequestedDocId(id);
    try {
      const res = await fetch(`/api/kb/doc?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      setSelectedDoc(await readKnowledgeResponse(res, isDocDetail));
    } catch (cause) {
      setDocError(cause instanceof KnowledgeRequestError ? cause : new Error("无法连接工作站，请确认本机服务已启动后重试。"));
    } finally {
      setLoadingDoc(false);
    }
  };

  const closeDoc = () => { setSelectedDoc(null); setDocError(null); setRequestedDocId(null); };
  const panelOpen = !!(selectedDoc || loadingDoc || docError);

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

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-[14px] bg-surface-2" />
          ))}
        </div>
      )}

      {error && !loading && <ReadError error={error} onRetry={() => setReload((value) => value + 1)} />}

      {data?.stats.total === 0 && !loading && (
        <div className="rounded-[14px] border border-dashed border-line py-16 text-center">
          <p className="text-[14px] text-muted">知识库中还没有可读取的文档</p>
          <p className="mt-1 text-[12.5px] text-muted">
            添加 Markdown 文档或检查现有文件格式后，重试读取。
          </p>
          <button type="button" onClick={() => setReload((value) => value + 1)} className="mt-4 text-[13px] text-terra">重试读取</button>
        </div>
      )}

      {!loading && data && data.stats.total > 0 && (
        <div className={`flex gap-5 items-start ${panelOpen ? "" : "flex-col"}`}>

          {/* 左栏：侧边栏（面板打开时）或完整布局 */}
          <div className={panelOpen ? "w-[210px] flex-none" : "w-full"}>

            {/* 搜索栏 */}
            <div className={`mb-4 ${panelOpen ? "" : "max-w-[480px]"}`}>
              <KbSearch docs={data.searchIndex} onSelect={openDoc} />
            </div>

            {/* Tab 切换 */}
            <div className="mb-4 flex gap-1 rounded-xl border border-line bg-surface p-1 w-fit">
              <button
                onClick={() => setTab("hubs")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                  tab === "hubs" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                <LayoutGrid size={13} />
                {panelOpen ? "枢纽" : "枢纽墙"}
              </button>
              <button
                onClick={() => setTab("graph")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                  tab === "graph" ? "bg-terra text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Network size={13} />
                关系图
              </button>
            </div>

            {/* 枢纽墙：面板打开时切紧凑侧边栏模式 */}
            {tab === "hubs" && (
              <HubWall
                hubs={data.hubCards}
                onSelect={openDoc}
                selectedId={selectedDoc?.id}
                compact={panelOpen}
              />
            )}

            {tab === "graph" && !panelOpen && (
              <KbGraph
                nodes={data.graph.nodes}
                edges={data.graph.edges}
                onNodeClick={openDoc}
              />
            )}
            {tab === "graph" && panelOpen && (
              <p className="text-[11.5px] text-muted px-1">关闭面板后查看关系图</p>
            )}
          </div>

          {/* 右栏：文档面板（面板打开时显示） */}
          {panelOpen && (
            <div className="flex-1 min-w-0 sticky top-6" style={{ maxHeight: "calc(100vh - 80px)" }}>
              {loadingDoc ? (
                <div className="flex h-64 items-center justify-center rounded-[14px] border border-line bg-surface">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-terra border-t-transparent" />
                </div>
              ) : docError ? (
                <ReadError error={docError} onRetry={() => { if (requestedDocId) void openDoc(requestedDocId); }} onClose={closeDoc} />
              ) : selectedDoc ? (
                <DocPanel
                  doc={selectedDoc}
                  onClose={closeDoc}
                  onSelect={openDoc}
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
