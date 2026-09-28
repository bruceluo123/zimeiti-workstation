import { NextRequest, NextResponse } from "next/server";
import { chatComplete, hasApiKey, type AiCallConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

interface TopicSuggestion {
  title: string;
  angle: string;        // 切入角度
  hook: string;         // 开场钩子示例
  platforms: string[];  // 建议平台
}

interface RequestBody {
  userIdea?: string;
  briefItems?: { title: string; summary?: string }[];
  styleProfile?: { tone?: string; authorLabel?: string };
  aiConfig?: AiCallConfig;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const { userIdea, briefItems = [], styleProfile, aiConfig } = body;

  if (!hasApiKey(aiConfig)) {
    return NextResponse.json(
      { error: "请先在设置页配置 API Key", suggestions: [] },
      { status: 503 }
    );
  }

  const briefContext = briefItems.slice(0, 8)
    .map((it, i) => `${i + 1}. ${it.title}${it.summary ? `——${it.summary.slice(0, 60)}` : ""}`)
    .join("\n");

  const authorInfo = styleProfile?.authorLabel ?? "自媒体创作者";
  const tone = styleProfile?.tone ?? "";

  const prompt = `你是一位${authorInfo}的内容策划助手。

## 今日早报素材
${briefContext || "（无早报素材）"}

## 用户想法
${userIdea ? `"${userIdea}"` : "（用户未提供想法，请从早报素材中提炼）"}

## 要求
根据上述素材，生成 3 个适合拍短视频/口播的选题方向。${tone ? `创作者风格：${tone}。` : ""}

每个选题需要：
- title：标题（吸睛，不超过25字）
- angle：切入角度（一句话说明视角/观点）
- hook：开场钩子示例（1-2句，能在前3秒抓住人）
- platforms：建议发布平台（从 xhs/douyin/x/wechat 中选）

以 JSON 数组返回，格式：
[{"title":"...","angle":"...","hook":"...","platforms":["douyin"]}]
只输出 JSON，不要其他文字。`;

  try {
    const raw = await chatComplete(
      [{ role: "user", content: prompt }],
      { temperature: 0.8, maxTokens: 800 },
      aiConfig
    );

    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]";
    const suggestions = JSON.parse(jsonStr) as TopicSuggestion[];

    return NextResponse.json({ suggestions: suggestions.slice(0, 3) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, suggestions: [] }, { status: 500 });
  }
}
