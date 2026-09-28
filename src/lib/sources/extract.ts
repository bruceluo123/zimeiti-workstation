import { load } from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SourceExtraction } from "@/types/source";
import { canonicalSourceUrl, parseSourceUrl, platformOf } from "./platform.ts";

const MAX_HTML_BYTES = 1_200_000;

export function isPrivateNetworkAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b, c] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0 && (c === 0 || c === 2))
      || (a === 192 && b === 168)
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113);
  }
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("2001:db8");
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("只支持公开的 HTTPS 文章链接");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("不能读取本机或局域网地址");
  let addresses: { address: string }[];
  try { addresses = await lookup(host, { all: true, verbatim: true }); }
  catch { throw new Error("无法解析这个文章链接，请检查链接或直接粘贴正文"); }
  if (!addresses.length || addresses.some(item => isPrivateNetworkAddress(item.address))) throw new Error("不能读取本机或局域网地址");
}

function compact(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function readHtml(response: Response): Promise<string> {
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error("来源没有提供可读取的网页正文，请粘贴文章或字幕");
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) { await reader.cancel(); break; }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

async function fetchPublicPage(start: URL): Promise<{ url: URL; html: string }> {
  let current = start;
  const platform = platformOf(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual", cache: "no-store",
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; MaimanfanWorkstation/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      const next = new URL(location, current);
      if (platform !== "article" && platformOf(next) !== platform) {
        throw new Error("链接跳转到了未支持的网站，请直接粘贴原文");
      }
      current = next;
      continue;
    }
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "平台限制了网页读取，请粘贴分享文字或正文" : "暂时无法读取该链接，请粘贴原文");
    return { url: current, html: await readHtml(response) };
  }
  throw new Error("链接跳转次数过多，请粘贴原文");
}

export async function extractPublicSource(rawUrl: string): Promise<SourceExtraction> {
  const url = parseSourceUrl(rawUrl);
  if (!url) throw new Error("请输入有效的 HTTPS 链接");
  const { url: finalUrl, html } = await fetchPublicPage(url);
  const $ = load(html);
  const meta = (key: string) => compact($(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content") ?? "");
  const title = compact(meta("og:title") || meta("twitter:title") || $("h1").first().text() || $("title").first().text()).slice(0, 200);
  const description = compact(meta("og:description") || meta("twitter:description") || meta("description"));
  const platform = platformOf(finalUrl);
  let body = description;
  let coverage: SourceExtraction["coverage"] = "preview";
  let note = "只读到公开页面简介；它不是完整原文，不能作为已核实的论据。可补贴全文、分享文字或字幕。";
  if (platform === "wechat") {
    $("#js_content script, #js_content style, #js_content noscript").remove();
    const sections = $("#js_content p").toArray().map((node) => compact($(node).text())).filter(Boolean);
    const article = compact(sections.length > 2 ? sections.join("\n") : $("#js_content").text());
    if (article.length >= 80) {
      body = article.slice(0, 30_000);
      coverage = article.length > 30_000 ? "excerpt" : "full";
      note = article.length > 30_000 ? "正文过长，已截取前 3 万字；引用前请回看原文。" : "已读取公开文章正文；引用数字和案例前仍请回看原文。";
    }
  } else if (platform === "article") {
    $("script, style, noscript, svg, nav, header, footer, aside, form").remove();
    const root = $("article, main, [role=main]").first();
    const container = root.length ? root : $("body");
    const sections = container.find("h1, h2, h3, p, li, blockquote").toArray()
      .map(node => compact($(node).text())).filter(text => text.length >= 8);
    const article = compact(sections.join("\n"));
    if (article.length >= 80) {
      body = article.slice(0, 30_000);
      coverage = article.length > 30_000 ? "excerpt" : "full";
      note = article.length > 30_000 ? "正文过长，已截取前 3 万字；引用前请回看原文。" : "已读取公开网页正文；引用数字和案例前仍请回看原文。";
    }
  }
  if (!title && !body) throw new Error("网页未返回可用文字，请直接粘贴正文或分享文字");
  return { platform, url: canonicalSourceUrl(finalUrl), title: title || "未命名素材", body: body.slice(0, 30_000), coverage, note };
}
