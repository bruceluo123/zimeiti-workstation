import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StyleProfile {
  // 口播风格
  tone: string;          // 例："轻松幽默，偶尔自嘲，不卖弄专业"
  openingStyle: string;  // 例："直接抛问题或结论，不要'大家好我是xxx'"
  pace: string;          // 例："语速中等，每句话不超过18字"
  forbidWords: string;   // 逗号分隔，例："首先,其次,总的来说,不得不说"
  // 剪辑习惯
  captionStyle: string;  // 例："字幕大字居中，关键词变色"
  bgmStyle: string;      // 例："lo-fi或轻电子，不用纯钢琴"
  // 平台偏好
  preferPlatforms: string[]; // 默认发到哪些平台
  // 个人标签
  authorLabel: string;   // 例："AI工具独立创作者"
}

const DEFAULT: StyleProfile = {
  tone: "轻松直接，有观点，偶尔自嘲，不卖弄专业词汇",
  openingStyle: "直接抛出反直觉结论或问题，不要'大家好我是xxx'开头",
  pace: "每句话控制在18字以内，说完一个意思就停顿",
  forbidWords: "首先,其次,总的来说,不得不说,毋庸置疑,深度赋能",
  captionStyle: "大字居中，关键词高亮或变色，节奏感强",
  bgmStyle: "lo-fi / 轻电子，不用纯钢琴或抒情曲",
  preferPlatforms: ["douyin", "xhs"],
  authorLabel: "AI工具独立创作者",
};

interface StyleState {
  profile: StyleProfile;
  setProfile: (p: Partial<StyleProfile>) => void;
  reset: () => void;
}

export const useStyleStore = create<StyleState>()(
  persist(
    (set) => ({
      profile: DEFAULT,
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      reset: () => set({ profile: DEFAULT }),
    }),
    { name: "zmt-style-profile" }
  )
);
