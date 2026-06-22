export type InspireSource = "ai" | "x";

export type InspireCategory =
  | "ai-models"
  | "ai-products"
  | "industry"
  | "paper"
  | "tip";

export interface InspireItem {
  id: string;
  source: InspireSource;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  category: InspireCategory | null;
  publishedAt: string | null;
  score: number | null;
}

export interface InspireResponse {
  success: boolean;
  ai: InspireItem[];
  x: InspireItem[];
  fetchedAt: string;
  error?: string;
}

export const CATEGORY_LABEL: Record<InspireCategory, string> = {
  "ai-models": "模型发布",
  "ai-products": "产品发布",
  industry: "行业动态",
  paper: "论文研究",
  tip: "技巧观点",
};
