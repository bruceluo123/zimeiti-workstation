"use client";

import { ExternalLink } from "lucide-react";

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

const HUB_COLORS: Record<string, { bg: string; accent: string; emoji: string }> = {
  MOC_知识总图:           { bg: "#fdf4ec", accent: "#bf5b33", emoji: "🗺️" },
  "MOC_AI变现与超级个体": { bg: "#fef9ec", accent: "#c99a3f", emoji: "💰" },
  MOC_自媒体内容创作:     { bg: "#f0f7f0", accent: "#7c8a6a", emoji: "✍️" },
  "MOC_选题与平台赛道":   { bg: "#eef6fb", accent: "#4a7fa5", emoji: "🎯" },
  "MOC_AI工具与Agent技术栈": { bg: "#f3eefb", accent: "#7b5ea7", emoji: "🤖" },
  "MOC_出海与GEO营销":    { bg: "#ecf8f6", accent: "#3d8c7f", emoji: "🌍" },
  "MOC_AI落地与ToB服务":  { bg: "#fbeef0", accent: "#a0404e", emoji: "🏢" },
  "MOC_思维模型与认知":   { bg: "#f5f0ec", accent: "#8B6914", emoji: "🧠" },
  "MOC_命理与修行":       { bg: "#f0eef8", accent: "#5c4a8a", emoji: "☯️" },
};

function defaultColor() {
  return { bg: "#faf6f0", accent: "#bf5b33", emoji: "📚" };
}

export function HubWall({ hubs, onSelect }: { hubs: HubCard[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {hubs.map((hub) => {
        const color = HUB_COLORS[hub.id] ?? defaultColor();
        const pendingCount = hub.todos.length;
        return (
          <button
            key={hub.id}
            onClick={() => onSelect(hub.id)}
            className="group relative flex flex-col items-start rounded-[14px] border border-line p-5 text-left transition hover:shadow-card"
            style={{ backgroundColor: color.bg, borderColor: color.accent + "33" }}
          >
            {/* emoji + 链接数 */}
            <div className="flex w-full items-start justify-between">
              <span className="text-[26px] leading-none">{color.emoji}</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: color.accent + "18", color: color.accent }}
                >
                  {hub.outLinkCount} 条
                </span>
                <a
                  href={hub.obsidianUri}
                  onClick={(e) => e.stopPropagation()}
                  title="在 Obsidian 打开"
                  className="opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                >
                  <ExternalLink size={13} style={{ color: color.accent }} />
                </a>
              </div>
            </div>

            {/* 标题 */}
            <h3
              className="mt-3 font-serif text-[15px] font-semibold leading-snug"
              style={{ color: color.accent }}
            >
              {hub.title.replace("MOC_", "")}
            </h3>

            {/* 摘要 */}
            <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
              {hub.summary}
            </p>

            {/* 待合成 OUT 钩子 */}
            {pendingCount > 0 && (
              <div
                className="mt-3 flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px]"
                style={{ backgroundColor: color.accent + "12", color: color.accent }}
              >
                <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: color.accent }} />
                {pendingCount} 条待合成
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
