export type TopicStage =
  | "idea"       // 选题待定
  | "material"   // 已收集素材
  | "shaped"     // 想法成形
  | "copy"       // 文案完成
  | "assets"     // 素材就绪
  | "ready"      // 待发布
  | "published"; // 已发布

export type Platform = "xhs" | "douyin" | "x" | "wechat";

export interface PublishItem {
  platform: Platform;
  title?: string;
  tags?: string[];
  coverUrl?: string;
  videoPath?: string; // 本地文件名（不传二进制）
}

export interface Topic {
  id: string;
  title: string;
  note?: string;
  script?: string;               // 口播方案全文
  publishItems?: PublishItem[];  // 各平台发布物料
  stage: TopicStage;
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
}

interface StageMeta {
  key: TopicStage;
  label: string;
  color: string;
}

export const STAGES: StageMeta[] = [
  { key: "idea",      label: "选题待定",  color: "#9a9aa4" },
  { key: "material",  label: "已收集素材", color: "#b45309" },
  { key: "shaped",    label: "想法成形",  color: "#047857" },
  { key: "copy",      label: "文案完成",  color: "#065f46" },
  { key: "assets",    label: "素材就绪",  color: "#0369a1" },
  { key: "ready",     label: "待发布",   color: "#4f46e5" },
  { key: "published", label: "已发布",   color: "#6b7280" },
];

export const STAGE_ORDER: TopicStage[] = STAGES.map((s) => s.key);

interface PlatformMeta {
  key: Platform;
  label: string;
  fg: string;
  bg: string;
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  xhs:    { key: "xhs",    label: "小红书", fg: "#be185d", bg: "#fce7f3" },
  douyin: { key: "douyin", label: "抖音",   fg: "#1d1d2e", bg: "#ededf5" },
  x:      { key: "x",      label: "X",     fg: "#0c4a6e", bg: "#e0f2fe" },
  wechat: { key: "wechat", label: "公众号", fg: "#14532d", bg: "#dcfce7" },
};

export function nextStage(stage: TopicStage): TopicStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

export function prevStage(stage: TopicStage): TopicStage {
  const i = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER[Math.max(i - 1, 0)];
}
