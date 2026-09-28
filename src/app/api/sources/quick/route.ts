import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { assistantAllowed, startWorker } from "@/lib/assistant/server";
import { extractPublicSource } from "@/lib/sources/extract";
import { parseQuickCapture } from "@/lib/sources/quick";
import { updateState } from "../../../../../scripts/assistant/store.mjs";
import { queueLibraryExtraction } from "../../../../../scripts/assistant/library.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sourceRoot = () => path.resolve(process.env.ZMT_SOURCE_DATA_DIR || path.join(os.homedir(), ".agent-reach", "zmt-import"));

export async function POST(request: Request) {
  if (!assistantAllowed(request)) return NextResponse.json({ error: "快速入库仅在本机工作站使用" }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length") || 0) > 1_200_000) throw new Error("单次粘贴内容过大，请拆成几份录入");
    const raw = await request.text();
    if (raw.length > 1_100_000) throw new Error("单次粘贴内容过大，请拆成几份录入");
    const body = JSON.parse(raw) as { input?: unknown; title?: unknown; model?: unknown };
    const model = typeof body.model === "string" ? body.model : "";
    if (!/^[a-z0-9.-]{1,80}$/.test(model)) throw new Error("本机 Codex 尚未连接，请稍后重试");
    const parsed = parseQuickCapture(typeof body.input === "string" ? body.input : "", typeof body.title === "string" ? body.title : "");
    if (parsed.mode === "collect") throw new Error("平台链接应先采集正文，请重新提交");
    const captured = parsed.mode === "article-url" ? await extractPublicSource(parsed.url) : null;
    const text = captured?.body || (parsed.mode === "text" ? parsed.text : "");
    const title = captured?.title || (parsed.mode === "text" ? parsed.title : "未命名资料");
    const url = captured?.url || (parsed.mode === "text" ? parsed.url : parsed.url);
    if (captured && (captured.coverage === "preview" || text.length < 80)) throw new Error("这个网页只返回了简介，没拿到完整正文；请把文章正文一起复制进来");
    if (text.length > 500_000) throw new Error("即时拆分最多 50 万字；更长资料请到 AI 工作台分批上传");

    const now = new Date().toISOString();
    const id = createHash("sha256").update(JSON.stringify([url || "", text])).digest("hex").slice(0, 24);
    const directory = path.join(sourceRoot(), "library");
    const file = path.join(directory, `${id}.json`);
    let createdAt = now;
    try { createdAt = JSON.parse(await readFile(file, "utf8")).createdAt || now; } catch { /* first capture */ }
    const source = {
      id, platform: "article", url, title, body: text,
      coverage: "full", captureMethod: "pasted_text", status: "ready",
      createdAt, updatedAt: now,
    };
    await mkdir(directory, { recursive: true });
    const temp = path.join(directory, `${id}.${randomUUID()}.tmp`);
    try { await writeFile(temp, JSON.stringify(source, null, 2), { encoding: "utf8", flag: "wx" }); await rename(temp, file); }
    finally { await unlink(temp).catch(() => {}); }

    let result;
    try {
      result = await updateState(state => queueLibraryExtraction(state, [source], model));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "暂时无法开始拆分";
      if (message.includes("当前有提炼任务")) {
        return NextResponse.json({ sourceId: id, queued: false, warning: "原文已存入来源资料；当前另有拆分任务，完成后可在来源资料中继续提炼。" }, { status: 202 });
      }
      throw cause;
    }
    if (result.jobId) {
      try { await startWorker(); }
      catch {
        await updateState(state => {
          const job = state.jobs.find(item => item.id === result.jobId);
          if (job?.status === "queued") { job.status = "failed"; job.error = "拆分进程启动失败，原文已经保存，请在资源库重试"; }
        });
        throw new Error("原文已保存，但拆分进程没有启动；请在资源库重试");
      }
    }
    return NextResponse.json({ sourceId: id, queued: Boolean(result.jobId), jobId: result.jobId, duplicate: !result.jobId });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "快速入库失败" }, { status: 400 });
  }
}
