import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { localCaptureAllowed } from "@/lib/sources/local-access";
import { parseSourceUrl, platformOf } from "@/lib/sources/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dataRoot = process.env.ZMT_SOURCE_DATA_DIR || path.join(os.homedir(), ".agent-reach", "zmt-import");

export async function POST(request: NextRequest) {
  if (!localCaptureAllowed(request)) return NextResponse.json({ error: "视频上传只在本机 3002 工作站开放" }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 121 * 1024 * 1024) {
    return NextResponse.json({ error: "视频文件最多 120 MB" }, { status: 413 });
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "视频上传格式无效" }, { status: 400 }); }
  const video = form.get("video");
  const rawUrl = form.get("url");
  const url = typeof rawUrl === "string" ? parseSourceUrl(rawUrl) : null;
  if (!url || platformOf(url) !== "douyin") return NextResponse.json({ error: "请同时保留这条抖音作品链接，方便核对来源" }, { status: 422 });
  if (!(video instanceof File) || !/\.(mp4|mov|webm)$/i.test(video.name) || video.size < 1000 || video.size > 120 * 1024 * 1024) {
    return NextResponse.json({ error: "请选择 120 MB 以内的 MP4、MOV 或 WebM 视频" }, { status: 422 });
  }
  const sourceId = createHash("sha256").update(`douyin:${url.pathname}`).digest("hex").slice(0, 24);
  await mkdir(dataRoot, { recursive: true });
  const lock = path.join(dataRoot, "collector.lock");
  try {
    const previous = JSON.parse(await readFile(lock, "utf8")) as { pid?: number };
    if (Number.isInteger(previous.pid) && previous.pid! > 0) {
      try { process.kill(previous.pid!, 0); }
      catch (cause) { if ((cause as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock); }
    } else if (Date.now() - (await stat(lock)).mtimeMs > 45 * 60 * 1000) await unlink(lock);
  } catch { /* No previous collector lock. */ }
  let handle;
  try { handle = await open(lock, "wx"); }
  catch { return NextResponse.json({ error: "已有视频采集任务在运行，请等它结束后再上传" }, { status: 409 }); }
  const folder = path.join(dataRoot, "captures", sourceId);
  const file = path.join(folder, "video-upload.mp4");
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(file, Buffer.from(await video.arrayBuffer()));
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts", "collect-source.mjs"), url.toString(), "--media", file, "--capture-only", "--refresh"], {
      cwd: process.cwd(), windowsHide: true, stdio: "ignore", env: process.env,
    });
    if (!child.pid) throw new Error("collector did not start");
    child.once("error", () => { void unlink(lock).catch(() => {}); });
    child.once("exit", () => { void unlink(lock).catch(() => {}); });
    await handle.writeFile(JSON.stringify({ sourceId, pid: child.pid || process.pid, startedAt: new Date().toISOString() }));
    await handle.close();
    return NextResponse.json({ accepted: true, sourceId }, { status: 202 });
  } catch {
    await handle.close().catch(() => {});
    await unlink(lock).catch(() => {});
    return NextResponse.json({ error: "本机视频文件保存失败，请重试" }, { status: 500 });
  }
}
