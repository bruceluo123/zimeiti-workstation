import type { StoredState } from './store.mjs';
export const libraryPrompt: string;
export function normalizeLibrarySources(documents: unknown): { id: string; title: string; text: string; url: string; author: string }[];
export function queueLibraryExtraction(state: StoredState, documents: unknown, model: string, message?: string): { jobId: string | null; conversationId?: string; sourceIds: string[]; skipped: { librarySourceId: string; sourceId: string; jobId?: string }[] };
export function queueLibraryExtractionWithOptions(state: StoredState, documents: unknown, model: string, options: { message?: string; force?: boolean }): { jobId: string | null; conversationId?: string; sourceIds: string[]; skipped: { librarySourceId: string; sourceId: string; jobId?: string }[] };
