export const BLOCK_KINDS = ['热点', '观点', '事实论据', '案例', '方法', '工具资料'] as const;
export const BUNDLE_ROLE_LABELS = {
  definition: '定义', claim: '核心说法', reason: '理由', problem: '问题', context: '背景', prerequisite: '前提',
  mechanism: '机制', evidence: '证据', example: '案例', comparison: '对比', counterpoint: '反方',
  formula: '公式', variable: '变量', step: '步骤', tool: '工具', action: '行动', result: '结果', caveat: '边界/风险', lesson: '启示',
} as const;
export const BUNDLE_TYPE_LABELS = {
  viewpoint: '观点论证', tutorial: '教程方法', case: '案例复盘', interview: '访谈观点',
  data: '数据事实', concept: '概念模型', mixed: '混合结构',
} as const;
export interface KnowledgeBlock {
  id: string; kind: string; title: string; body: string; quote: string;
  sourceId: string; chunkId: string; locator: string; tags: string[];
  bundleId?: string; bundleTitle?: string;
  bundleType?: keyof typeof BUNDLE_TYPE_LABELS;
  bundleRole?: keyof typeof BUNDLE_ROLE_LABELS;
  status: 'pending' | 'approved' | 'rejected'; verification: string;
  conversationId: string; model: string; createdAt: string; reviewedAt?: string;
}
export interface AssistantSource { id: string; title: string; url: string; kind: string; chunkCount: number; characters: number; createdAt: string; author?: string; librarySourceIds?: string[] }
export interface AssistantMessage { id: string; role: 'user' | 'assistant'; text: string; jobId: string; part?: number; createdAt?: string }
export interface AssistantJob {
  id: string; conversationId: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  completed: number; total?: number; progress?: string; error?: string; model: string;
  origin?: 'library'; mode?: string; sourceIds?: string[];
  schemaVersion?: number;
  createdAt?: string; updatedAt?: string;
  context?: { profile: boolean; historyCount: number; relatedIds: string[] };
}
export interface AssistantState {
  version: number; profile: string;
  conversations: { id: string; title: string; messages: AssistantMessage[] }[];
  sources: AssistantSource[]; blocks: KnowledgeBlock[]; jobs: AssistantJob[];
}
