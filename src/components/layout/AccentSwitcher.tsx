"use client";

import { useEffect, useState } from "react";

type Accent = "indigo" | "green";

const OPTIONS: { key: Accent; label: string; dot: string }[] = [
  { key: "indigo", label: "靛蓝", dot: "#4f46e5" },
  { key: "green", label: "墨绿", dot: "#047857" },
];

export function AccentSwitcher() {
  const [accent, setAccent] = useState<Accent>("indigo");

  useEffect(() => {
    const saved = (localStorage.getItem("zmt-accent") as Accent) || "indigo";
    setAccent(saved);
    document.documentElement.dataset.accent = saved;
  }, []);

  const pick = (a: Accent) => {
    setAccent(a);
    document.documentElement.dataset.accent = a;
    localStorage.setItem("zmt-accent", a);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-card border border-line bg-surface px-1.5 py-1.5 shadow-card">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => pick(o.key)}
          className={
            "flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] transition-colors " +
            (accent === o.key
              ? "bg-terra-wash font-medium text-terra-deep"
              : "text-ink-soft hover:bg-surface-2")
          }
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.dot }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
