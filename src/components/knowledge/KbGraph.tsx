"use client";

import { useEffect, useRef, useState } from "react";

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

interface KbGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick: (id: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ForceGraphRenderer({ Component, graphData, width, height, onNodeClick }: {
  Component: React.ComponentType<any>;
  graphData: unknown;
  width: number;
  height: number;
  onNodeClick: (id: string) => void;
}) {
  return (
    <Component
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="#1c1714"
      nodeColor={(n: { color: string }) => n.color}
      nodeVal={(n: { val: number }) => n.val}
      nodeLabel={(n: { label: string }) => n.label}
      linkColor={() => "rgba(255,255,255,0.08)"}
      linkWidth={0.8}
      onNodeClick={(n: { id: string }) => onNodeClick(n.id)}
      nodeCanvasObject={(
        node: { x?: number; y?: number; color: string; val: number; label: string; kind: string },
        ctx: CanvasRenderingContext2D,
        globalScale: number
      ) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const r = Math.sqrt(node.val) * 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = node.color;
        ctx.fill();
        if (node.kind === "hub" || globalScale > 2.5) {
          const fontSize = node.kind === "hub" ? 10 / globalScale : 8 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label.slice(0, 12), x, y + r + fontSize * 0.8);
        }
      }}
    />
  );
}

const KIND_COLOR: Record<GraphNode["kind"], string> = {
  hub:    "#bf5b33",
  source: "#c99a3f",
  topic:  "#7c8a6a",
  entity: "#4a7fa5",
  other:  "#988b7c",
};

export function KbGraph({ nodes, edges, onNodeClick }: KbGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ForceGraph, setForceGraph] = useState<React.ComponentType<unknown> | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 480 });

  // dynamic import: react-force-graph-2d 只能在浏览器加载
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph(() => mod.default as React.ComponentType<unknown>);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setDims({ w: rect.width, h: rect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const graphData = {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.label.replace("MOC_", ""),
      kind: n.kind,
      linkCount: n.linkCount,
      val: n.kind === "hub" ? Math.max(n.linkCount * 1.5, 6) : Math.max(n.linkCount, 2),
      color: KIND_COLOR[n.kind],
    })),
    links: edges.map((e) => ({ source: e.source, target: e.target })),
  };

  return (
    <div ref={containerRef} className="relative h-[480px] w-full overflow-hidden rounded-[14px] border border-line bg-[#1c1714]">
      {/* 图例 */}
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-[8px] bg-black/40 px-3 py-2 text-[11px] text-white/70 backdrop-blur-sm">
        {(Object.entries(KIND_COLOR) as [GraphNode["kind"], string][]).map(([kind, color]) => (
          <div key={kind} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: color }} />
            {{ hub: "枢纽", source: "素材", topic: "主题", entity: "人物", other: "其他" }[kind]}
          </div>
        ))}
      </div>

      {ForceGraph ? (
        <ForceGraphRenderer
          Component={ForceGraph}
          graphData={graphData}
          width={dims.w}
          height={dims.h}
          onNodeClick={onNodeClick}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[13px] text-white/40">
          图谱加载中…
        </div>
      )}
    </div>
  );
}
