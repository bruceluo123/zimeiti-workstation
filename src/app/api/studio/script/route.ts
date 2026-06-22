import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/ai";

export const dynamic = "force-dynamic";

interface StyleProfile {
  tone?: string;
  openingStyle?: string;
  pace?: string;
  forbidWords?: string;
  captionStyle?: string;
  bgmStyle?: string;
  authorLabel?: string;
}

interface RequestBody {
  title: string;
  note?: string;
  angle?: string;
  styleProfile?: StyleProfile;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody;
  const { title, note, angle, styleProfile } = body;

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({
      script: `# ${title}\n\n> ⚠️ 请配置 DEEPSEEK_API_KEY 后使用 AI 生成功能\n\n在此处手动填写口播方案…`,
    });
  }

  const sp = styleProfile ?? {};
  const forbidList = sp.forbidWords ? `\n- 禁用词：${sp.forbidWords}` : "";

  const systemPrompt = `你是${sp.authorLabel ?? "自媒体创作者"}的口播文案助手。

## 创作者风格档案
- 口播语气：${sp.tone ?? "轻松直接，有观点"}
- 开场风格：${sp.openingStyle ?? "直接抛结论或问题，不要'大家好'开头"}
- 节奏要求：${sp.pace ?? "每句话不超过18字"}${forbidList}
- 字幕风格：${sp.captionStyle ?? "大字居中，关键词高亮"}
- BGM 风格：${sp.bgmStyle ?? "lo-fi / 轻电子"}`;

  const userPrompt = `请为以下选题生成完整的短视频口播方案：

**选题标题**：${title}
${note ? `**创作者备注**：${note}` : ""}
${angle ? `**切入角度**：${angle}` : ""}

请输出以下结构（Markdown 格式）：

## 口播稿
（完整稿子，约500-800字，分段，每段4-6句话，适合连续口播）

## 拍摄备注
- 机位/场景建议
- 关键道具或演示
- 情绪节奏提示

## 字幕关键词
（列出3-5个适合放大展示的关键词/金句）

## BGM 建议
（1-2句说明曲风和情绪）

## 发布文案
- 小红书标题（带话题标签）：
- 抖音标题：
- X 推文（英文/中文）：`;

  try {
    const script = await chatComplete(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.75, maxTokens: 2000 }
    );
    return NextResponse.json({ script });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
