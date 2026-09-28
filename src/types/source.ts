export type SourcePlatform = "x" | "xiaohongshu" | "douyin" | "wechat" | "weibo" | "article";
export type SourceCoverage = "full" | "excerpt" | "preview";

export interface SourceDocument {
  id: string;
  platform: SourcePlatform;
  url?: string;
  title: string;
  body: string;
  coverage: SourceCoverage;
  captureMethod: "public_page" | "pasted_text" | "link_only" | "browser_cli" | "local_asr";
  status?: "collecting" | "transcribing" | "captured" | "analyzing" | "ready" | "failed";
  error?: string;
  author?: string;
  book?: {
    id: string; title: string; url: string; chapterNumber: number; chapterTitle: string;
    chapterIntro: string; itemNumber: number; anchor: string; grade: string; ratio: string;
    lead: string; references: { text: string; urls: string[] }[];
  };
  analysis?: SourceAnalysis;
  repositories?: RepositoryResource[];
  transcript?: { text: string; duration: number; engine: string; reviewRequired: boolean; segments: { start: number; end: number; text: string }[] };
  frames?: { time: number; file: string }[];
  createdAt: string;
  updatedAt: string;
}

export const SOURCE_CATEGORIES = ["干货方法", "工具资料", "思想观点", "行业信息", "视频拆解"] as const;
export interface SourceAnalysis {
  category: (typeof SOURCE_CATEGORIES)[number];
  tags: string[];
  summary: string;
  keyPoints: string[];
  evidence: { quote: string; kind: string; verification: string }[];
  segments: { part: string; start: number; end: number; summary: string; technique: string }[];
  cautions: string[];
  model: string;
  generatedAt: string;
}
export interface RepositoryResource {
  url: string;
  name: string;
  purpose: string;
  license: string;
  verified: boolean;
}

export interface SourceExtraction {
  platform: SourcePlatform;
  url: string;
  title: string;
  body: string;
  coverage: SourceCoverage;
  note: string;
}

export interface DraftEvidence {
  id: string;
  sourceId: string;
  quote: string;
}

export interface WritingDraft {
  id: string;
  title: string;
  body: string;
  evidence: DraftEvidence[];
  createdAt: string;
  updatedAt: string;
}
