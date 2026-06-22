import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Platform, PublishItem, Topic, TopicStage } from "@/types/topic";
import { nextStage, prevStage } from "@/types/topic";
import { uid } from "@/lib/utils";

interface TopicsState {
  topics: Topic[];
  addTopic: (title: string, platforms: Platform[]) => void;
  removeTopic: (id: string) => void;
  moveTopic: (id: string, dir: "next" | "prev") => void;
  setStage: (id: string, stage: TopicStage) => void;
  updateTopic: (id: string, patch: Partial<Omit<Topic, "id" | "createdAt">>) => void;
  setPublishItem: (id: string, item: PublishItem) => void;
  applyRemote: (remote: Topic[]) => void;
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
    (set) => ({
      topics: seed,
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
    { name: "zmt-topics" }
  )
);
