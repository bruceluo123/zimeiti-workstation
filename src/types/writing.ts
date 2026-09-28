import type { KnowledgeBlock } from './assistant';

export interface WritingReference {
  id: string; blockId?: string; sourceId: string; sourceTitle: string; sourceUrl: string;
  quote: string; locator: string; mode: 'quote' | 'paraphrase' | 'memo'; text: string;
  marker: string; status: 'active' | 'modified' | 'removed' | 'memo'; createdAt: string;
}
export interface KnowledgeDraft {
  id: string; title: string; body: string; revision: number; createdAt: string; updatedAt: string;
  sourceThoughtId?: string;
  references: WritingReference[];
  publications: { id: string; url: string; createdAt: string; referenceIds: string[] }[];
}
export interface UsageEvent { id: string; draftId: string; referenceId: string; blockId?: string; action: string; createdAt: string }
export interface WritingState { drafts: KnowledgeDraft[]; events: UsageEvent[] }
export interface WritingCandidate { block: KnowledgeBlock; sourceTitle: string; sourceUrl: string; score: number; usedDrafts: number }
export interface EvidenceAnalysis {
  model: string; gaps: string[];
  suggestions: { blockId: string; role: '支持论据' | '相关案例' | '反例与限制' | '背景材料'; reason: string; caution: string }[];
}
