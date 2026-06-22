"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Sparkles, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { Topic } from "@/types/topic";
import { PLATFORMS, STAGE_ORDER } from "@/types/topic";
import { useTopicsStore } from "@/store/topics-store";
import { useStyleStore } from "@/store/style-store";

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const moveTopic = useTopicsStore((s) => s.moveTopic);
  const removeTopic = useTopicsStore((s) => s.removeTopic);
  const updateTopic = useTopicsStore((s) => s.updateTopic);
  const profile = useStyleStore((s) => s.profile);

  const [generating, setGenerating] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftScript, setDraftScript] = useState(topic.script ?? "");
  const [genError, setGenError] = useState<string | null>(null);

  const stageIndex = STAGE_ORDER.indexOf(topic.stage);
  const isFirst = stageIndex === 0;
  const isLast = stageIndex === STAGE_ORDER.length - 1;
  const hasScript = !!topic.script;
  const canGenerate = ["idea", "material", "shaped", "copy"].includes(topic.stage);

  const generateScript = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          note: topic.note,
          styleProfile: profile,
        }),
      });
      const data = (await res.json()) as { script?: string; error?: string };
      if (data.error) throw new Error(data.error);
      const newScript = data.script ?? "";
      updateTopic(topic.id, {
        script: newScript,
        stage: topic.stage === "idea" || topic.stage === "material" || topic.stage === "shaped"
          ? "copy"
          : topic.stage,
      });
      setDraftScript(newScript);
      setScriptOpen(true);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const saveEdit = () => {
    updateTopic(topic.id, { script: draftScript });
    setEditing(false);
  };

  return (
    <div className="rounded-card border border-line bg-surface shadow-card transition hover:border-terra/40">
      {/* Header */}
      <div className="flex items-start gap-2 p-3.5">
        <p className="flex-1 text-[13.5px] font-semibold leading-snug text-ink">
          {topic.title}
        </p>
        <button
          type="button"
          onClick={() => removeTopic(topic.id)}
          aria-label="删除选题"
          className="flex-none text-muted opacity-0 transition hover:text-red-500 group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {topic.note && (
        <p className="px-3.5 pb-1 text-[11.5px] leading-relaxed text-ink-soft">{topic.note}</p>
      )}

      {/* Platforms */}
      <div className="flex flex-wrap items-center gap-1 px-3.5 pb-3">
        {topic.platforms.map((p) => {
          const meta = PLATFORMS[p];
          return (
            <span
              key={p}
              className="rounded-[4px] px-[6px] py-0.5 text-[10px] font-medium"
              style={{ color: meta.fg, background: meta.bg }}
            >
              {meta.label}
            </span>
          );
        })}
      </div>

      {/* Script section */}
      {hasScript && (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setScriptOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3.5 py-2 text-[11.5px] text-ink-soft hover:text-ink"
          >
            <span className="font-medium">口播方案</span>
            {scriptOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {scriptOpen && (
            <div className="px-3.5 pb-3">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={draftScript}
                    onChange={(e) => setDraftScript(e.target.value)}
                    rows={12}
                    className="w-full rounded-[6px] border border-line bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink outline-none focus:border-terra"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-[5px] bg-terra px-3 py-1.5 text-[11px] font-medium text-white"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setDraftScript(topic.script ?? ""); }}
                      className="rounded-[5px] border border-line px-3 py-1.5 text-[11px] text-ink-soft"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/script relative">
                  <pre className="max-h-[240px] overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-soft">
                    {topic.script}
                  </pre>
                  <button
                    type="button"
                    onClick={() => { setEditing(true); setDraftScript(topic.script ?? ""); }}
                    className="absolute right-0 top-0 rounded-[4px] border border-line bg-surface p-1 opacity-0 transition group-hover/script:opacity-100"
                    aria-label="编辑口播方案"
                  >
                    <Pencil className="h-3 w-3 text-ink-soft" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {genError && (
        <p className="px-3.5 pb-2 text-[11px] text-red-500">{genError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 border-t border-line px-3 py-2">
        {canGenerate && (
          <button
            type="button"
            onClick={generateScript}
            disabled={generating}
            className="flex items-center gap-1 rounded-[5px] border border-terra-wash bg-terra-wash px-2.5 py-1 text-[11px] font-medium text-terra-deep transition enabled:hover:border-terra enabled:hover:bg-terra enabled:hover:text-white disabled:opacity-60"
          >
            <Sparkles className="h-3 w-3" />
            {generating ? "生成中…" : hasScript ? "重新生成" : "生成口播方案"}
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => moveTopic(topic.id, "prev")}
            disabled={isFirst}
            aria-label="退回上一阶段"
            className="grid h-6 w-6 place-items-center rounded-[4px] text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-default disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => moveTopic(topic.id, "next")}
            disabled={isLast}
            aria-label="推进到下一阶段"
            className="grid h-6 w-6 place-items-center rounded-[4px] text-terra transition hover:bg-terra-wash disabled:cursor-default disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
