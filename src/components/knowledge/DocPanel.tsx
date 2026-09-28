"use client";

import { X, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { wikiLinkId } from "./response";

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

const KIND_LABEL: Record<string, string> = {
  hub: "枢纽",
  source: "素材",
  topic: "主题",
  entity: "人物",
  other: "其他",
};

/** 把 Obsidian [[WikiLink]] 语法转为相对查询参数链接
 *  用 ?wiki=id 而非自定义协议，避免 react-markdown v10 的 urlTransform 将其清空 */
function processWikiLinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_, target: string, display: string | undefined) => {
      const label = display ?? target;
      // 取 basename（去掉路径前缀和 .md 后缀）作为 id
      const id = target.replace(/\.md$/, "").split("/").pop() ?? target;
      return `[${label}](?wiki=${encodeURIComponent(id)})`;
    }
  );
}

interface DocPanelProps {
  doc: DocDetail;
  onClose: () => void;
  onSelect?: (id: string) => void;
}

export function DocPanel({ doc, onClose, onSelect }: DocPanelProps) {
  const processedContent = processWikiLinks(doc.content);

  const mdComponents: Components = {
    a({ href, children, ...props }) {
      if (href?.startsWith("?wiki=")) {
        const id = wikiLinkId(href);
        if (!id) return <span title="知识库链接无效，请在原文中修正。">{children}</span>;
        return (
          <button
            type="button"
            onClick={() => onSelect?.(id)}
            className="cursor-pointer font-medium text-terra underline decoration-terra/40 hover:decoration-terra"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-none rounded-[5px] border border-line px-2 py-0.5 text-[11px] text-muted">
            {KIND_LABEL[doc.kind] ?? doc.kind}
          </span>
          <h2 className="truncate font-serif text-[15px] font-semibold text-ink">{doc.title}</h2>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <a
            href={doc.obsidianUri}
            title="在 Obsidian 中编辑"
            className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] text-ink-soft transition hover:border-terra hover:text-terra"
          >
            <ExternalLink size={12} />
            Obsidian
          </a>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 元数据 */}
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-2.5">
        {doc.tags.map((t) => (
          <span key={t} className="rounded-full bg-terra-wash px-2.5 py-0.5 text-[11px] text-terra-deep">
            {t}
          </span>
        ))}
        {doc.updated && (
          <span className="text-[11.5px] text-muted">更新 {doc.updated}</span>
        )}
      </div>

      {/* 待合成钩子 */}
      {doc.todos.length > 0 && (
        <div className="border-b border-line bg-terra-wash px-5 py-3">
          <p className="mb-1.5 text-[11.5px] font-semibold text-terra">待合成 {doc.todos.length} 条</p>
          <ul className="space-y-1">
            {doc.todos.map((todo, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px] text-terra-deep">
                <span className="mt-0.5 flex-none">○</span>
                <span>{todo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 正文 — [[WikiLink]] 已转为可点击按钮 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="prose prose-sm max-w-none text-ink prose-headings:font-serif prose-headings:text-ink prose-a:text-terra prose-code:text-terra prose-code:bg-surface-2 prose-code:rounded prose-code:px-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
    </aside>
  );
}
