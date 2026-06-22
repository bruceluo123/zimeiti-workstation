export type TopicStage =
  | "idea" // 选题待定
  | "material" // 已收集素材
  | "shaped" // 想法成形
  | "copy" // 文案完成
  | "assets" // 素材就绪
  | "ready" // 待发布
  | "published"; // 已发布

export type Platform = "xhs" | "douyin" | "x" | "wechat";

export interface Topic {
  id: string;
  title: string;
  note?: string;
  stage: TopicStage;
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
}

interface StageMeta {
  key: TopicStage;
  label: string;
  color: string; // dot / accent color
}

export const STAGES: StageMeta[] = [
  { key: "idea", label: "选题待定", color: "#988b7c" },
  { key: "material", label: "已收集素材", color: "#c99a3f" },
  { key: "shaped", label: "想法成形", color: "#7c8a6a" },
  { key: "copy", label: "文案完成", color: "#bf5b33" },
  { key: "assets", label: "素材就绪", color: "#9e4422" },
  { key: "ready", label: "待发布", color: "#3b3a52" },
  { key: "published", label: "已发布", color: "#7c8a6a" },
];

export const STAGE_ORDER: TopicStage[] = STAGES.map((s) => s.key);

interface PlatformMeta {
  key: Platform;
  label: string;
  fg: string;
  bg: string;
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  xhs: { key: "xhs", label: "小红书", fg: "#c4365a", bg: "#fdeaef" },
  douyin: { key: "douyin", label: "抖音", fg: "#3b3a52", bg: "#eae9f0" },
  x: { key: "x", label: "X", fg: "#2b5a6e", bg: "#e6eef2" },
  wechat: { key: "wechat", label: "公众号", fg: "#3f6b4a", bg: "#e7f1e9" },
};

export function nextStage(stage: TopicStage): TopicStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

export function prevStage(stage: TopicStage): TopicStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.max(i - 1, 0)];
}
