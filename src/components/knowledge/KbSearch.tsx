"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import MiniSearch from "minisearch";

interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  summary: string;
  kind: string;
  path: string;
}

const KIND_LABEL: Record<string, string> = {
  hub: "枢纽",
  source: "素材",
  topic: "主题",
  entity: "人物",
  other: "其他",
};

interface KbSearchProps {
  docs: SearchDoc[];
  onSelect: (id: string) => void;
}

export function KbSearch({ docs, onSelect }: KbSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchDoc[]>([]);
  const msRef = useRef<MiniSearch<SearchDoc> | null>(null);

  useEffect(() => {
    const ms = new MiniSearch<SearchDoc>({
      fields: ["title", "tags", "summary"],
      storeFields: ["id", "title", "tags", "summary", "kind", "path"],
      searchOptions: { prefix: true, fuzzy: 0.2 },
    });
    ms.addAll(docs);
    msRef.current = ms;
  }, [docs]);

  useEffect(() => {
    if (!msRef.current || !query.trim()) {
      setResults([]);
      return;
    }
    const r = msRef.current.search(query).slice(0, 10);
    setResults(r as unknown as SearchDoc[]);
  }, [query]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-terra">
        <Search size={14} className="flex-none text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索知识库…"
          className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <X size={13} className="text-muted hover:text-terra" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-[12px] border border-line bg-surface shadow-card">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => { onSelect(r.id); setQuery(""); }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-2"
              >
                <span className="mt-px rounded-[5px] border border-line px-1.5 py-0.5 text-[10.5px] text-muted flex-none">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-ink">{r.title}</div>
                  {r.summary && (
                    <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">{r.summary}</div>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
