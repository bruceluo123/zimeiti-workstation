import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Platform = "xhs" | "douyin" | "x" | "wechat";

interface RequestBody {
  title: string;
  script?: string;
  platform: Platform;
}

const PLATFORM_GUIDE: Record<Platform, string> = {
  xhs:    "小红书：标题带1-2个#话题，不超过20字；正文前50字吸引人；tags是热门标签",
  douyin: "抖音：标题吸睛，带1-2个#话题；tags用热搜词",
  x:      "X（Twitter）：标题即推文，140字内；tags用英文或中英混合",
  wechat: "微信公众号：标题正式一些，25字内；tags是关键词",
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const { title, script, platform } = body;

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      title: `${title} | ${platform} 配置 DEEPSEEK_API_KEY 后可自动生成`,
      tags: ["AI", "创作者"],
      coverPrompt: `${title}，简洁现代风格，${platform}封面`,
    });
  }

  const scriptSnippet = script ? script.slice(0, 600) : "";
  const guide = PLATFORM_GUIDE[platform] ?? "";

  const prompt = `根据以下短视频内容，生成${platform}平台的发布物料。

**选题**：${title}
**口播稿摘录**：${scriptSnippet || "（无）"}
**平台规范**：${guide}

请输出 JSON（只输出 JSON，不要其他文字）：
{
  "title": "发布标题",
  "tags": ["标签1","标签2","标签3","标签4","标签5"],
  "coverPrompt": "封面图 AI 生成提示词（英文，描述画面构图、风格、关键视觉元素，适合作为短视频封面）"
}`;

  try {
    const raw = await chatComplete(
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 400 }
    );
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const meta = JSON.parse(jsonStr) as { title?: string; tags?: string[]; coverPrompt?: string };
    return NextResponse.json({
      title: meta.title ?? title,
      tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 6) : [],
      coverPrompt: meta.coverPrompt ?? title,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
