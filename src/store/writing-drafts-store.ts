"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DraftEvidence, WritingDraft } from "@/types/source";
import { uid } from "@/lib/utils";

interface WritingDraftsState {
  drafts: WritingDraft[];
  activeId: string | null;
  createDraft: () => string;
  selectDraft: (id: string) => void;
  updateDraft: (id: string, patch: Pick<WritingDraft, "title" | "body">) => void;
  addEvidence: (id: string, sourceId: string, quote: string) => void;
  removeEvidence: (id: string, evidenceId: string) => void;
}

export const useWritingDraftsStore = create<WritingDraftsState>()(
  persist((set) => ({
    drafts: [], activeId: null,
    createDraft: () => {
      const id = uid();
      const now = new Date().toISOString();
      set((state) => ({ drafts: [{ id, title: "", body: "", evidence: [], createdAt: now, updatedAt: now }, ...state.drafts], activeId: id }));
      return id;
    },
    selectDraft: (activeId) => set({ activeId }),
    updateDraft: (id, patch) => set((state) => ({ drafts: state.drafts.map((draft) => draft.id === id ? { ...draft, ...patch, updatedAt: new Date().toISOString() } : draft) })),
    addEvidence: (id, sourceId, quote) => set((state) => ({ drafts: state.drafts.map((draft) => {
      if (draft.id !== id || draft.evidence.some((item) => item.sourceId === sourceId && item.quote === quote)) return draft;
      const evidence: DraftEvidence = { id: uid(), sourceId, quote };
      return { ...draft, evidence: [...draft.evidence, evidence], updatedAt: new Date().toISOString() };
    }) })),
    removeEvidence: (id, evidenceId) => set((state) => ({ drafts: state.drafts.map((draft) => draft.id === id ? { ...draft, evidence: draft.evidence.filter((item) => item.id !== evidenceId), updatedAt: new Date().toISOString() } : draft) })),
  }), { name: "zmt-writing-drafts" })
);
