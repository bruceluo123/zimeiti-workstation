import { NextRequest, NextResponse } from "next/server";

// DashScope 通义万象图像生成 API（异步任务模式）
// 参考 baoyu-cover-image skill 的 5 维度维度体系，翻译成英文 prompt 再调用
const DS_BASE = "https://dashscope.aliyuncs.com/api/v1";

// 维度参数 → 提示词片段（参考 baoyu-cover-image SKILL.md 的维度体系）
const TYPE_PROMPTS: Record<string, string> = {
  hero: "bold hero composition, large focal element, strong visual impact",
  conceptual: "abstract conceptual illustration, metaphorical symbols, intellectual depth",
  typography: "typography-focused design, elegant lettering, text as visual element",
  metaphor: "visual metaphor, symbolic imagery, layered meaning",
  scene: "atmospheric scene, environmental storytelling, mood-driven",
  minimal: "ultra-minimal design, maximum white space, single focal point",
};

const PALETTE_PROMPTS: Record<string, string> = {
  warm: "warm color palette, terracotta, amber, cream tones",
  elegant: "elegant muted palette, dusty rose, sage, warm gray",
  cool: "cool color palette, steel blue, slate, frost tones",
  dark: "dark dramatic palette, deep navy, charcoal, gold accents",
  earth: "earth tones, ochre, sienna, forest green, clay",
  vivid: "vivid saturated colors, high contrast, bold hues",
  pastel: "soft pastel palette, light and airy, gentle gradients",
  mono: "monochromatic black and white, high contrast",
  retro: "retro vintage palette, muted oranges, olive green, mustard",
};

const RENDERING_PROMPTS: Record<string, string> = {
  "flat-vector": "flat vector illustration style, clean geometric shapes, no gradients",
  "hand-drawn": "hand-drawn sketch style, organic lines, artistic imperfection",
  painterly: "painterly digital art, visible brush strokes, expressive texture",
  digital: "polished digital art, smooth gradients, professional finish",
  pixel: "pixel art style, retro 8-bit aesthetic, blocky forms",
  chalk: "chalk illustration on dark board, dusty texture, hand-crafted feel",
};

const ASPECT_SIZE: Record<string, string> = {
  "16:9": "1280*720",
  "1:1": "1024*1024",
  "9:16": "720*1280",
};

interface GenerateBody {
  title: string;
  type?: string;
  palette?: string;
  rendering?: string;
  aspect?: string;
}

function buildPrompt(body: GenerateBody): string {
  const type = TYPE_PROMPTS[body.type ?? "conceptual"] ?? TYPE_PROMPTS.conceptual;
  const palette = PALETTE_PROMPTS[body.palette ?? "warm"] ?? PALETTE_PROMPTS.warm;
  const rendering = RENDERING_PROMPTS[body.rendering ?? "flat-vector"] ?? RENDERING_PROMPTS["flat-vector"];
  const titleHint = body.title ? `visual representation of "${body.title.slice(0, 60)}", ` : "";
  return `${titleHint}cover image for article, ${type}, ${palette}, ${rendering}, no text overlay, professional editorial design, high quality`;
}

async function dsPost(path: string, body: unknown, key: string) {
  const res = await fetch(`${DS_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function dsPoll(taskId: string, key: string, maxMs = 60000): Promise<string | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${DS_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = (await res.json()) as {
      output?: { task_status?: string; results?: { url: string }[] };
    };
    const status = json.output?.task_status;
    if (status === "SUCCEEDED") {
      return json.output?.results?.[0]?.url ?? null;
    }
    if (status === "FAILED") return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DASHSCOPE_API_KEY 未配置。请在 Vercel 环境变量或 .env.local 中设置。" },
      { status: 503 }
    );
  }

  const body = (await req.json()) as GenerateBody;
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "title 不能为空" }, { status: 400 });
  }

  const prompt = buildPrompt(body);
  const size = ASPECT_SIZE[body.aspect ?? "16:9"] ?? "1280*720";

  // 1. 创建异步任务
  const taskRes = (await dsPost(
    "/services/aigc/text2image/image-synthesis",
    { model: "wanx-v1", input: { prompt }, parameters: { size, n: 1 } },
    apiKey
  )) as { output?: { task_id?: string; task_status?: string }; message?: string };

  const taskId = taskRes.output?.task_id;
  if (!taskId) {
    return NextResponse.json(
      { error: `DashScope 任务创建失败: ${taskRes.message ?? "unknown"}` },
      { status: 502 }
    );
  }

  // 2. 轮询直到完成
  const url = await dsPoll(taskId, apiKey);
  if (!url) {
    return NextResponse.json(
      { error: "图像生成超时或失败，请重试" },
      { status: 504 }
    );
  }

  return NextResponse.json({ url, prompt });
}
