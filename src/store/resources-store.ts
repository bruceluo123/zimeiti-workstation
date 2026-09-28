"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Thought } from "@/types/thought";
import type { ContentResource, ResourceKind } from "@/types/resource";
import type { SourceDocument } from "@/types/source";
import { uid } from "@/lib/utils";

interface ResourcesState {
  resources: ContentResource[];
  addFromThought: (thought: Thought, kind: ResourceKind) => void;
  addFromSource: (source: SourceDocument, excerpt: string, kind: ResourceKind) => void;
  addFromAnalysis: (item: { body: string; kind: ResourceKind; sourceUrl?: string; sourceDocumentId?: string }) => void;
  removeResource: (id: string) => void;
}

function titleFromThought(thought: Thought): string {
  const firstLine = thought.content.split(/\n+/).find(Boolean)?.trim();
  return firstLine ? firstLine.slice(0, 42) : `图片随笔 · ${new Date(thought.createdAt).toLocaleDateString("zh-CN")}`;
}

export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set) => ({
      resources: [],
      addFromThought: (thought, kind) => set((state) => {
        const current = Array.isArray(state.resources) ? state.resources : [];
        const existing = current.find((item) => item.sourceThoughtId === thought.id);
        if (existing) {
          return { resources: current.map((item) => item.id === existing.id ? { ...item, kind, updatedAt: new Date().toISOString() } : item) };
        }
        const now = new Date().toISOString();
        return {
          resources: [{
            id: uid(), title: titleFromThought(thought), body: thought.content, kind,
            sourceThoughtId: thought.id, sourceUrl: thought.sourceUrl, imageIds: thought.imageIds,
            createdAt: now, updatedAt: now,
          }, ...current],
        };
      }),
      addFromSource: (source, excerpt, kind) => set((state) => {
        const body = excerpt.trim();
        if (!body) return state;
        const current = Array.isArray(state.resources) ? state.resources : [];
        if (current.some((item) => item.sourceDocumentId === source.id && item.body === body)) return state;
        const now = new Date().toISOString();
        return { resources: [{
          id: uid(), title: body.slice(0, 42) || source.title, body, kind,
          sourceDocumentId: source.id, sourceUrl: source.url, createdAt: now, updatedAt: now,
        }, ...current] };
      }),
      addFromAnalysis: (item) => set((state) => {
        const body = item.body.trim();
        if (!body) return state;
        const current = Array.isArray(state.resources) ? state.resources : [];
        if (current.some((resource) => resource.origin === "ai_analysis" && resource.body === body && resource.kind === item.kind && resource.sourceUrl === item.sourceUrl)) return state;
        const now = new Date().toISOString();
        return { resources: [{
          id: uid(), title: body.slice(0, 42), body, kind: item.kind,
          sourceUrl: item.sourceUrl, sourceDocumentId: item.sourceDocumentId,
          origin: "ai_analysis", createdAt: now, updatedAt: now,
        }, ...current] };
      }),
      removeResource: (id) => set((state) => ({ resources: (Array.isArray(state.resources) ? state.resources : []).filter((item) => item.id !== id) })),
    }),
    { name: "zmt-content-resources" }
  )
);
