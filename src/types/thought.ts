export type ThoughtTag = "判断" | "困惑" | "选题灵感" | "一手体感";

export const THOUGHT_TAGS: ThoughtTag[] = ["判断", "困惑", "选题灵感", "一手体感"];

export interface Thought {
  id: string;
  content: string;
  tags: string[];
  createdAt: string; // ISO 8601
}
