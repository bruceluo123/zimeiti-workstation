import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Platform, PublishItem, Topic, TopicStage } from "@/types/topic";
import { nextStage, prevStage } from "@/types/topic";
import { uid } from "@/lib/utils";
import type { AiCallConfig } from "@/lib/ai";

interface StyleProfile {
  tone?: string;
  openingStyle?: string;
  pace?: string;
  forbidWords?: string;
  captionStyle?: string;
  bgmStyle?: string;
  authorLabel?: string;
}

interface TopicsState {
  topics: Topic[];
  /** 正在后台生成脚本的 topic ID 列表（不持久化） */
  generatingIds: string[];
  /** 生成失败时的错误信息（不持久化） */
  generateErrors: Record<string, string>;
  addTopic: (title: string, platforms: Platform[]) => void;
  removeTopic: (id: string) => void;
  moveTopic: (id: string, dir: "next" | "prev") => void;
  setStage: (id: string, stage: TopicStage) => void;
  updateTopic: (id: string, patch: Partial<Omit<Topic, "id" | "createdAt">>) => void;
  setPublishItem: (id: string, item: PublishItem) => void;
  applyRemote: (remote: Topic[]) => void;
  /** 后台生成口播方案：切换页面不会中断 */
  generateScript: (id: string, opts: { title: string; note?: string; styleProfile: StyleProfile; aiConfig: AiCallConfig }) => Promise<void>;
}

function now(): string {
  return new Date().toISOString();
}

/** 按 id 合并远端：远端 updatedAt 较新者获胜，保留仅本地的项 */
function mergeTopics(local: Topic[], remote: Topic[]): Topic[] {
  const map = new Map<string, Topic>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) {
    const cur = map.get(t.id);
    if (!cur || t.updatedAt >= cur.updatedAt) map.set(t.id, t);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const seed: Topic[] = [
  {
    id: "t-1",
    title: "更新疲劳：我们真的需要追每一次模型发布吗",
    note: "来自今早的一句念头，角度反直觉，值得验证。",
    stage: "idea",
    platforms: ["x"],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "t-2",
    title: "DeepSeek V4 降价，对独立创作者意味着什么",
    note: "早报转化，蹭热点 + 实操角度。",
    stage: "idea",
    platforms: ["xhs"],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "t-3",
    title: "提示词是「调」出来的不是「写」出来的",
    note: "已存 3 条案例 + 1 个金句 + 原推。",
    stage: "material",
    platforms: ["douyin", "xhs"],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "t-4",
    title: "为什么我把自媒体工作流搬出了 Obsidian",
    note: "一手体感，核心论点已列 3 条，等扩写。",
    stage: "shaped",
    platforms: ["x", "wechat"],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "t-5",
    title: "一人公司用 6 个 Agent 月入 10 万",
    note: "口播稿 740 字 · 钩子已设 · DeepSeek 生成。",
    stage: "copy",
    platforms: ["douyin", "xhs"],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "t-6",
    title: "5 分钟讲清楚什么是 Agent",
    note: "已进发布箱，排期今晚 20:00。",
    stage: "ready",
    platforms: ["douyin", "x", "wechat"],
    createdAt: now(),
    updatedAt: now(),
  },
];

export const useTopicsStore = create<TopicsState>()(
  persist(
    (set, get) => ({
      topics: seed,
      generatingIds: [],
      generateErrors: {},
      generateScript: async (id, { title, note, styleProfile, aiConfig }) => {
        if (get().generatingIds.includes(id)) return;

        set((s) => ({
          generatingIds: [...s.generatingIds, id],
          generateErrors: Object.fromEntries(
            Object.entries(s.generateErrors).filter(([k]) => k !== id)
          ),
        }));
        try {
          const res = await fetch("/api/studio/script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, note, styleProfile, aiConfig }),
          });
          const data = (await res.json()) as { script?: string; error?: string };
          if (!res.ok || data.error) throw new Error(data.error || `生成失败（HTTP ${res.status}）`);
          const newScript = data.script?.trim();
          if (!newScript) throw new Error("模型返回了空内容，请重试");
          set((state) => ({
            topics: state.topics.map((t) => {
              if (t.id !== id) return t;
              const newStage =
                t.stage === "idea" || t.stage === "material" || t.stage === "shaped"
                  ? "copy"
                  : t.stage;
              return { ...t, script: newScript, stage: newStage, updatedAt: now() };
            }),
          }));
        } catch (e) {
          const msg = e instanceof Error ? e.message : "生成失败";
          set((s) => ({
            generateErrors: { ...s.generateErrors, [id]: msg },
          }));
        } finally {
          set((s) => ({
            generatingIds: s.generatingIds.filter((gid) => gid !== id),
          }));
        }
      },
      addTopic: (title, platforms) =>
        set((state) => ({
          topics: [
            {
              id: uid(),
              title: title.trim(),
              stage: "idea",
              platforms,
              createdAt: now(),
              updatedAt: now(),
            },
            ...state.topics,
          ],
        })),
      removeTopic: (id) =>
        set((state) => ({ topics: state.topics.filter((t) => t.id !== id) })),
      moveTopic: (id, dir) =>
        set((state) => ({
          topics: state.topics.map((t) =>
            t.id === id
              ? {
                  ...t,
                  stage: dir === "next" ? nextStage(t.stage) : prevStage(t.stage),
                  updatedAt: now(),
                }
              : t
          ),
        })),
      setStage: (id, stage) =>
        set((state) => ({
          topics: state.topics.map((t) =>
            t.id === id ? { ...t, stage, updatedAt: now() } : t
          ),
        })),
      updateTopic: (id, patch) =>
        set((state) => ({
          topics: state.topics.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: now() } : t
          ),
        })),
      setPublishItem: (id, item) =>
        set((state) => ({
          topics: state.topics.map((t) => {
            if (t.id !== id) return t;
            const existing = (t.publishItems ?? []).filter((p) => p.platform !== item.platform);
            return { ...t, publishItems: [...existing, item], updatedAt: now() };
          }),
        })),
      applyRemote: (remote) =>
        set((state) => ({ topics: mergeTopics(state.topics, remote) })),
    }),
    {
      name: "zmt-topics",
      partialize: (state) => ({ topics: state.topics }),
    }
  )
);
