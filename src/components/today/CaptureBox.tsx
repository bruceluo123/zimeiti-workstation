"use client";

import { useState } from "react";
import { useThoughtsStore } from "@/store/thoughts-store";
import { THOUGHT_TAGS } from "@/types/thought";
import { cn } from "@/lib/utils";

export function CaptureBox() {
  const addThought = useThoughtsStore((s) => s.addThought);
  const [value, setValue] = useState("");
  const [active, setActive] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const toggleTag = (tag: string) => {
    setActive((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!value.trim()) return;
    addThought(value, active);
    setValue("");
    setActive([]);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="mb-7 rounded-card border border-line bg-surface p-6 shadow-card">
      <h3 className="font-serif text-[19px] font-semibold">此刻的念头</h3>
      <p className="mb-3.5 text-[13px] text-muted">
        写下任何判断、困惑、反直觉的观察，或看到某条新闻时的即时反应。
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSave();
        }}
        placeholder="比如：今天看到 Claude 又更新了，但我更好奇的是——为什么没人讨论『更新疲劳』这件事……"
        className="min-h-[74px] w-full resize-none rounded-[10px] border border-line bg-bg px-4 py-3.5 font-serif text-[16px] leading-relaxed text-ink outline-none transition focus:border-terra focus:shadow-[0_0_0_3px_var(--terra-wash)] placeholder:italic placeholder:text-muted"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {THOUGHT_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={cn(
              "rounded-full border px-3 py-[5px] text-[12px] transition",
              active.includes(tag)
                ? "border-terra bg-terra-wash text-terra-deep"
                : "border-line bg-surface text-ink-soft hover:border-terra hover:text-terra-deep"
            )}
          >
            # {tag}
          </button>
        ))}
        <button
          type="button"
          onClick={handleSave}
          className="ml-auto rounded-lg bg-terra px-[18px] py-2.5 text-[13px] font-medium text-white shadow-[0_4px_10px_-4px_rgba(159,68,34,0.55)] transition hover:bg-terra-deep"
        >
          {saved ? "已记下 ✓" : "记下这一笔"}
        </button>
      </div>
    </div>
  );
}
