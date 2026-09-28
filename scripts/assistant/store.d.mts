import type { AssistantState, AssistantSource, AssistantJob, KnowledgeBlock } from '../../src/types/assistant';
export interface SourceChunk { id: string; locator: string; text: string }
export type StoredSource = Omit<AssistantSource, 'chunkCount' | 'characters'> & { hash: string; chunks: SourceChunk[] };
export type StoredJob = AssistantJob & { message: string; mode: string; sourceIds: string[]; profile: string; createdAt: string; updatedAt: string; runVersion?: string };
export type StoredState = Omit<AssistantState, 'sources' | 'jobs'> & { sources: StoredSource[]; jobs: StoredJob[] };
export function dataRoot(): string;
export function now(): string;
export function uid(): string;
export function acquireLock(name: string, waitMs?: number): Promise<() => Promise<void>>;
export function readState(): Promise<StoredState>;
export function updateState<T>(change: (state: StoredState) => T | Promise<T>): Promise<T>;
export function publicState(state: StoredState): AssistantState;
export function addSource(state: StoredState, input: { title: string; text: string; pages?: { locator: string; text: string }[]; url?: string; kind?: string }): StoredSource;
export const KINDS: string[];
export function titleFromQuote(quote: string): string;
export function normalizeQuotedBlocks(state: StoredState): number;
export function reviewQuotedBlock(state: StoredState, id: string, status: 'approved' | 'rejected', text?: string, kind?: string): KnowledgeBlock;
