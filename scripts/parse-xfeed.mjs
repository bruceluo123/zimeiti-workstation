/**
 * 从每日早报 markdown 提取 X 推文，写入 workstation/data/x-feed.json
 * 用法：node scripts/parse-xfeed.mjs [早报路径]
 * 默认读取今天的 D:\wiki\个人知识库\daily\YYYY-MM-DD\00_早报.md
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function todayPath() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10);
  return `D:\\wiki\\个人知识库\\daily\\${dateStr}\\00_早报.md`;
}

const mdPath = process.argv[2] ?? todayPath();

if (!existsSync(mdPath)) {
  console.log(`[parse-xfeed] 文件不存在: ${mdPath}，写入空数组`);
  writeFileSync(join(ROOT, "data", "x-feed.json"), "[]", "utf-8");
  process.exit(0);
}

const content = readFileSync(mdPath, "utf-8");

// 匹配 ## 𝕏 / ## X 部分下的推文行
// 格式示例：- **@handle**: [推文内容](url)\n  - Summary: 摘要
const xSection = content.match(/##\s+[𝕏X][\s\S]*?(?=\n##|\n---|\n$|$)/)?.[0] ?? "";

const items = [];
let idx = 0;

// 匹配形如：- **@xxx**: [title](url)
const lineRe = /^-\s+\*\*(@[\w]+)\*\*:\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gm;
let m;
while ((m = lineRe.exec(xSection)) !== null) {
  const [, handle, title, url] = m;
  // 尝试抓 Summary 行
  const summaryMatch = xSection.slice(m.index + m[0].length).match(/^\s*\n\s+-\s+Summary:\s*(.+)/);
  items.push({
    id: `x-${Date.now()}-${idx++}`,
    source: "x",
    title: `${handle}: ${title}`.slice(0, 120),
    summary: summaryMatch?.[1]?.trim() ?? "",
    url,
    sourceName: handle,
    category: null,
    publishedAt: new Date().toISOString(),
    score: null,
  });
}

const out = join(ROOT, "data", "x-feed.json");
writeFileSync(out, JSON.stringify(items, null, 2), "utf-8");
console.log(`[parse-xfeed] 写入 ${items.length} 条 → ${out}`);
