"use client";

import { useStyleStore } from "@/store/style-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Save, RotateCcw } from "lucide-react";
import { useState } from "react";

function Field({
  label,
  hint,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12.5px] font-medium text-ink">{label}</label>
      {hint && <p className="mb-1.5 text-[11.5px] text-muted">{hint}</p>}
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-[12.5px] text-ink outline-none focus:border-terra"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-[12.5px] text-ink outline-none focus:border-terra"
        />
      )}
    </div>
  );
}

export function SettingsPage() {
  const { profile, setProfile, reset } = useStyleStore();
  const [saved, setSaved] = useState(false);

  const [draft, setDraft] = useState({ ...profile });

  const handleSave = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    reset();
    setDraft({ ...useStyleStore.getState().profile });
  };

  return (
    <div className="max-w-[720px] px-[38px] pb-16 pt-9">
      <PageHeader eyebrow="系统" title="设置" sub="风格档案 · AI 生成偏好 · MCP 配置" />

      {/* Style profile section */}
      <section className="mb-8">
        <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-ink">创作风格档案</h2>
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <Field
            label="作者定位"
            hint="一句话描述你的创作者身份，会出现在 AI prompt 里"
            value={draft.authorLabel}
            onChange={(v) => setDraft((d) => ({ ...d, authorLabel: v }))}
          />
          <Field
            label="口播语气"
            hint="描述你的表达风格，例：轻松幽默、干货直给、反直觉"
            value={draft.tone}
            onChange={(v) => setDraft((d) => ({ ...d, tone: v }))}
            rows={2}
          />
          <Field
            label="开场风格"
            hint="开场3秒的惯用手法，例：直接抛结论、先抛问题"
            value={draft.openingStyle}
            onChange={(v) => setDraft((d) => ({ ...d, openingStyle: v }))}
            rows={2}
          />
          <Field
            label="节奏要求"
            hint="每句话长度、停顿习惯"
            value={draft.pace}
            onChange={(v) => setDraft((d) => ({ ...d, pace: v }))}
          />
          <Field
            label="禁用词（逗号分隔）"
            hint="AI 生成文案时会避开这些词"
            value={draft.forbidWords}
            onChange={(v) => setDraft((d) => ({ ...d, forbidWords: v }))}
          />
          <Field
            label="字幕风格"
            hint="字幕设计偏好，供剪辑参考"
            value={draft.captionStyle}
            onChange={(v) => setDraft((d) => ({ ...d, captionStyle: v }))}
          />
          <Field
            label="BGM 风格"
            hint="背景音乐偏好"
            value={draft.bgmStyle}
            onChange={(v) => setDraft((d) => ({ ...d, bgmStyle: v }))}
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-[6px] bg-terra px-4 py-2 text-[12.5px] font-medium text-white transition hover:bg-terra-deep"
            >
              <Save className="h-3.5 w-3.5" />
              {saved ? "已保存 ✓" : "保存"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-2 text-[12px] text-ink-soft transition hover:border-line hover:text-ink"
            >
              <RotateCcw className="h-3 w-3" /> 恢复默认
            </button>
          </div>
        </div>
      </section>

      {/* MCP config section */}
      <section>
        <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-ink">MCP 配置（一键发布）</h2>
        <div className="rounded-card border border-line bg-surface p-5 text-[12.5px] text-ink-soft">
          <p className="mb-3 text-ink">一键发布需要在 Claude Code 里配置平台 MCP。以下是各平台的配置方式：</p>

          <div className="mb-4 flex flex-col gap-3">
            {[
              {
                name: "小红书",
                key: "xhs",
                steps: [
                  "安装 MCP：在 Claude Code 运行 /mcp，搜索 xhs 或 xiaohongshu",
                  "授权：首次运行时会弹出扫码授权，用手机扫码",
                  "测试：在 Claude Code 聊天框发「帮我发一条小红书」验证连通",
                ],
              },
              {
                name: "抖音",
                key: "douyin",
                steps: [
                  "抖音暂无官方 MCP，可用 browser-automation MCP（需 Chrome 插件）",
                  "安装：npm install -g @mcp/browser-automation",
                  "配置 ~/.claude/settings.json 的 mcpServers 字段",
                ],
              },
              {
                name: "X / Twitter",
                key: "x",
                steps: [
                  "安装 Twitter MCP：在 Claude Code 搜索 twitter 或 x-mcp",
                  "填入 API Key / Bearer Token（从 developer.twitter.com 获取）",
                  "测试：发「帮我发一条推文 hello world」",
                ],
              },
              {
                name: "微信公众号",
                key: "wechat",
                steps: [
                  "公众号暂无开放 MCP，需用 browser-automation 自动化操作草稿箱",
                  "或手动复制生成的标题和正文，在公众号编辑器发布",
                ],
              },
            ].map((plat) => (
              <div key={plat.key} className="rounded-[6px] border border-line p-4">
                <p className="mb-2 font-semibold text-ink">{plat.name}</p>
                <ol className="list-inside list-decimal space-y-1 text-[12px]">
                  {plat.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="rounded-[6px] border border-terra-wash bg-terra-wash px-4 py-3 text-[12px] text-terra-deep">
            <p className="font-medium">配置完成后</p>
            <p className="mt-0.5">回到发布箱，刷新页面，"一键发布"按钮会自动激活。</p>
          </div>
        </div>
      </section>

      {/* 9am automation */}
      <section className="mt-8">
        <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-ink">9 点自动化</h2>
        <div className="rounded-card border border-line bg-surface p-5 text-[12.5px] text-ink-soft">
          <p className="mb-3 text-ink">在 PowerShell（管理员）运行一次，注册 Windows 计划任务：</p>
          <code className="block rounded-[6px] border border-line bg-surface-2 p-3 font-mono text-[11.5px]">
            powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1
          </code>
          <p className="mt-3">注册后每天 9:00 自动运行 daily-input 技能、更新 X feed、推送 git → Vercel 部署。</p>
          <p className="mt-1.5">手动测试：<code className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px]">schtasks /Run /TN ZmtDaily9am</code></p>
        </div>
      </section>
    </div>
  );
}
