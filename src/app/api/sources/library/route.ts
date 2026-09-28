import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir, mkdir, open, unlink, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { localCaptureAllowed } from "@/lib/sources/local-access";
import { parseSourceUrl, platformOf } from "@/lib/sources/platform";
import { sourceIdentity } from "../../../../../scripts/collect-source.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dataRoot = process.env.ZMT_SOURCE_DATA_DIR || path.join(os.homedir(), ".agent-reach", "zmt-import");
const library = path.join(dataRoot, "library");

export async function GET(request: NextRequest) {
  if (!localCaptureAllowed(request)) return NextResponse.json({ error: "登录态采集在本机工作站运行；线上版可导入采集结果，不会上传你的浏览器登录凭据。" }, { status: 403 });
  await mkdir(library, { recursive: true });
  const sources = await Promise.all((await readdir(library)).filter(name => /^[a-f0-9]{24}\.json$/.test(name)).map(async name => JSON.parse(await readFile(path.join(library, name), "utf8"))));
  return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!localCaptureAllowed(request)) return NextResponse.json({ error: "请在本机工作站启动采集；线上站点不能直接使用你的 Chrome 登录态。" }, { status: 403 });
  const body = await request.text();
  if (body.length > 5000) return NextResponse.json({ error: "链接过长" }, { status: 413 });
  let input;
  try { input = JSON.parse(body); } catch { return NextResponse.json({ error: "请求格式无效" }, { status: 400 }); }
  const url = typeof input?.url === "string" ? parseSourceUrl(input.url.replaceAll("\\:", ":").replaceAll("\\.", ".")) : null;
  if (!url || platformOf(url) === "article") return NextResponse.json({ error: "请输入支持的平台链接" }, { status: 422 });
  if (!["x.com", "www.x.com", "twitter.com", "weibo.com", "www.weibo.com", "mp.weixin.qq.com", "www.xiaohongshu.com", "xiaohongshu.com", "xhslink.com", "www.xhslink.com", "www.douyin.com", "v.douyin.com", "douyin.com"].includes(url.hostname)
    || (platformOf(url) === "x" && !/\/status\/\d+/.test(url.pathname))
    || (platformOf(url) === "weibo" && !/^\/\d+\/[a-zA-Z0-9]+\/?$/.test(url.pathname))) {
    return NextResponse.json({ error: "请粘贴具体作品的分享链接，不是平台首页或个人主页。" }, { status: 422 });
  }
  await mkdir(library, { recursive: true });
  // One expensive browser/ASR task at a time; lock survives development reloads.
  const lock = path.join(dataRoot, "collector.lock");
  // A stopped local server must not leave the collector permanently locked.
  try {
    const previous = JSON.parse(await readFile(lock, "utf8"));
    if (Number.isInteger(previous.pid) && previous.pid > 0) {
      try { process.kill(previous.pid, 0); }
      catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock); }
    } else if (Date.now() - (await stat(lock)).mtimeMs > 45 * 60 * 1000) await unlink(lock);
  } catch { /* No lock yet, or another request is currently creating it. */ }
  let handle;
  try { handle = await open(lock, "wx"); }
  catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "EEXIST") return NextResponse.json({ error: "无法写入本机素材目录，请检查目录权限和磁盘空间。" }, { status: 500 });
    return NextResponse.json({ error: "已有采集任务运行中，请等它完成后再提交。" }, { status: 409 });
  }
  const job = createHash("sha256").update(url.toString()).digest("hex").slice(0, 24);
  const autoExtract = input?.autoExtract === true;
  const model = typeof input?.model === "string" ? input.model : "";
  if (autoExtract && !/^[a-z0-9.-]{1,80}$/.test(model)) {
    await unlink(lock).catch(() => {});
    return NextResponse.json({ error: "本机 Codex 尚未连接，无法自动拆分" }, { status: 400 });
  }
  const captureOnly = input?.captureOnly === true && platformOf(url) === "douyin";
  const sourceId = sourceIdentity(url.toString()).id;
  await handle.writeFile(JSON.stringify({ job, pid: process.pid, startedAt: new Date().toISOString() })); await handle.close();
  try {
    const script = autoExtract ? "quick-capture.mjs" : "collect-source.mjs";
    const args = autoExtract
      ? [path.join(process.cwd(), "scripts", script), url.toString(), model]
      : [path.join(process.cwd(), "scripts", script), url.toString(), ...(captureOnly ? ["--capture-only"] : []), ...(input?.refresh === true ? ["--refresh"] : [])];
    const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: "ignore", env: process.env });
    child.once("error", () => { void unlink(lock).catch(() => {}); });
    child.once("exit", () => { void unlink(lock).catch(() => {}); });
    try { writeFileSync(lock, JSON.stringify({ job, pid: child.pid || process.pid, startedAt: new Date().toISOString() })); }
    catch (cause) { child.kill(); throw cause; }
  } catch {
    await unlink(lock).catch(() => {});
    return NextResponse.json({ error: "本机采集进程无法启动" }, { status: 500 });
  }
  return NextResponse.json({ accepted: true, job, sourceId, autoExtract }, { status: 202 });
}
