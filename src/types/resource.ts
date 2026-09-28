export const RESOURCE_KINDS = ["观点", "钩子", "痛点", "场景", "案例", "佐证", "行动"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export interface ContentResource {
  id: string;
  title: string;
  body: string;
  kind: ResourceKind;
  sourceThoughtId?: string;
  sourceDocumentId?: string;
  sourceUrl?: string;
  origin?: "ai_analysis";
  imageIds?: string[];
  createdAt: string;
  updatedAt: string;
}
