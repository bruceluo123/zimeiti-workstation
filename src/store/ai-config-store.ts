"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const AI_PRESETS: { label: string; baseUrl: string; model: string; hint?: string }[] = [
  { label: "DeepSeek 最新 Flash", baseUrl: "https://api.deepseek.com/v1",                      model: "deepseek-flash",    hint: "支持文字和图片" },
  { label: "DeepSeek V4 Pro", baseUrl: "https://api.deepseek.com/v1",                           model: "deepseek-v4-pro",   hint: "文字分析" },
  { label: "OpenAI GPT",  baseUrl: "https://api.openai.com/v1",                                model: "gpt-4o",            hint: "platform.openai.com" },
  { label: "通义千问",    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",        model: "qwen-max",          hint: "dashscope.aliyuncs.com" },
  { label: "月之暗面",    baseUrl: "https://api.moonshot.cn/v1",                               model: "moonshot-v1-8k",    hint: "platform.moonshot.cn" },
  { label: "智谱 GLM",   baseUrl: "https://open.bigmodel.cn/api/paas/v4",                     model: "glm-4-plus",        hint: "bigmodel.cn" },
  { label: "自定义",      baseUrl: "",                                                          model: "" },
];

const DEFAULT: AiConfig = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-flash",
};

interface AiConfigState {
  config: AiConfig;
  setConfig: (patch: Partial<AiConfig>) => void;
  reset: () => void;
}

export const useAiConfigStore = create<AiConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ config: DEFAULT }),
    }),
    { name: "zmt-ai-config" }
  )
);
