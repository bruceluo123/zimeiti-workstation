"use client";

import { useEffect, useRef } from "react";
import { startSync, stopSync, syncPush, syncDelete, type DataType } from "@/lib/sync";
import { useThoughtsStore } from "@/store/thoughts-store";
import { useTopicsStore } from "@/store/topics-store";
import type { Thought } from "@/types/thought";
import type { Topic } from "@/types/topic";

/**
 * 多设备同步桥接：把 Zustand store 与 Upstash KV 双向连接。
 * - 远端变更 → 合并进本地 store（applyRemote，按 id 合并）
 * - 本地变更 → 防抖推送到远端（syncPush）
 * - 本地删除 → 通过 id-diff 检测并写墓碑（syncDelete），再推送
 * 仅在客户端挂载后运行，不参与 SSR。
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const prevThoughtIds = useRef<Set<string>>(new Set());
  const prevTopicIds = useRef<Set<string>>(new Set());
  const ready = useRef(false);

  useEffect(() => {
    const applyThoughts = useThoughtsStore.getState().applyRemote;
    const applyTopics = useTopicsStore.getState().applyRemote;

    startSync((type: DataType, data: unknown[]) => {
      if (type === "thoughts") applyThoughts(data as Thought[]);
      else if (type === "topics") applyTopics(data as Topic[]);
    });

    // 初始化基线 id 集合，避免首帧把 seed 误判为删除
    prevThoughtIds.current = new Set(useThoughtsStore.getState().thoughts.map((t) => t.id));
    prevTopicIds.current = new Set(useTopicsStore.getState().topics.map((t) => t.id));
    ready.current = true;

    const unsubThoughts = useThoughtsStore.subscribe((state) => {
      const ids = new Set(state.thoughts.map((t) => t.id));
      handleChange("thoughts", prevThoughtIds, ids, state.thoughts);
    });
    const unsubTopics = useTopicsStore.subscribe((state) => {
      const ids = new Set(state.topics.map((t) => t.id));
      handleChange("topics", prevTopicIds, ids, state.topics);
    });

    function handleChange(
      type: DataType,
      prevRef: React.MutableRefObject<Set<string>>,
      nextIds: Set<string>,
      data: unknown[]
    ) {
      if (!ready.current) return;
      const removed = Array.from(prevRef.current).filter((id) => !nextIds.has(id));
      prevRef.current = nextIds;
      if (removed.length) {
        syncDelete(type, removed).then(() => syncPush(type, data));
      } else {
        syncPush(type, data);
      }
    }

    return () => {
      unsubThoughts();
      unsubTopics();
      stopSync();
    };
  }, []);

  return <>{children}</>;
}
