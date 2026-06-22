import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Thought } from "@/types/thought";
import { uid } from "@/lib/utils";

interface ThoughtsState {
  thoughts: Thought[];
  addThought: (content: string, tags: string[]) => void;
  removeThought: (id: string) => void;
  applyRemote: (remote: Thought[]) => void;
}

/** 按 id 合并远端：远端获胜，但保留仅存在于本地的项（未推送的新增不丢失） */
function mergeThoughts(local: Thought[], remote: Thought[]): Thought[] {
  const map = new Map<string, Thought>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) map.set(t.id, t);
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const seed: Thought[] = [
  {
    id: "seed-1",
    content:
      "把工作流搬出 Obsidian 这件事，越想越对。文本工具的问题不是功能不够，是「打开就累」。内容生产需要的是推进感，不是归档感。",
    tags: ["一手体感"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    content:
      "反直觉观察：大家都在追模型更新，但「更新疲劳」可能才是普通用户的真实状态。追不动了，反而是个好选题。",
    tags: ["困惑", "选题灵感"],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
];

export const useThoughtsStore = create<ThoughtsState>()(
  persist(
    (set) => ({
      thoughts: seed,
      addThought: (content, tags) =>
        set((state) => ({
          thoughts: [
            {
              id: uid(),
              content: content.trim(),
              tags,
              createdAt: new Date().toISOString(),
            },
            ...state.thoughts,
          ],
        })),
      removeThought: (id) =>
        set((state) => ({
          thoughts: state.thoughts.filter((t) => t.id !== id),
        })),
      applyRemote: (remote) =>
        set((state) => ({ thoughts: mergeThoughts(state.thoughts, remote) })),
    }),
    { name: "zmt-thoughts" }
  )
);
