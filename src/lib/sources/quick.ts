import type { SourcePlatform } from "@/types/source";
import { parseSourceUrl, platformOf } from "./platform.ts";

export type QuickCaptureInput =
  | { mode: "collect"; url: string; platform: Exclude<SourcePlatform, "article"> }
  | { mode: "text"; text: string; url?: string; title: string }
  | { mode: "article-url"; url: string };

function cleaned(value: string): string {
  return value.replaceAll("\\:", ":").replaceAll("\\.", ".").trim();
}

function inferredTitle(text: string): string {
  const first = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "粘贴的资料";
  return first.replace(/^#+\s*/, "").slice(0, 80) || "粘贴的资料";
}

export function parseQuickCapture(value: string, suppliedTitle = ""): QuickCaptureInput {
  const input = cleaned(value);
  if (!input) throw new Error("请粘贴文字、文章正文或具体作品链接");
  const url = parseSourceUrl(input);
  if (url && platformOf(url) !== "article") {
    return { mode: "collect", url: url.toString(), platform: platformOf(url) as Exclude<SourcePlatform, "article"> };
  }
  if (url) {
    const match = input.match(/https?:\/\/[^\s<>"']+/i)?.[0] || "";
    const text = input.replace(match, "").trim();
    if (text.length < 2) return { mode: "article-url", url: url.toString() };
    return { mode: "text", text, url: url.toString(), title: suppliedTitle.trim().slice(0, 180) || inferredTitle(text) };
  }
  if (input.length < 2) throw new Error("内容太短，请至少粘贴一句完整文字");
  return { mode: "text", text: input, title: suppliedTitle.trim().slice(0, 180) || inferredTitle(input) };
}
