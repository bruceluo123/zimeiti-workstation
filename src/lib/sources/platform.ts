import type { SourcePlatform } from "@/types/source";

const HOSTS: Record<Exclude<SourcePlatform, "article">, string[]> = {
  x: ["x.com", "twitter.com"],
  xiaohongshu: ["xiaohongshu.com", "xhslink.com"],
  douyin: ["douyin.com", "iesdouyin.com"],
  wechat: ["mp.weixin.qq.com"],
  weibo: ["weibo.com", "weibo.cn"],
};

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  x: "X", xiaohongshu: "小红书", douyin: "抖音", wechat: "公众号", weibo: "微博", article: "文章 / 其他",
};

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function platformOf(url: URL): SourcePlatform {
  const host = url.hostname.toLowerCase();
  for (const [platform, hosts] of Object.entries(HOSTS)) {
    if (hosts.some((value) => hostMatches(host, value))) return platform as SourcePlatform;
  }
  return "article";
}

export function parseSourceUrl(value: string): URL | null {
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0].replace(/[，。！？、)）\]]+$/, ""));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return url;
  } catch { return null; }
}

export function isSupportedPublicHost(url: URL): boolean {
  return platformOf(url) !== "article";
}

export function canonicalSourceUrl(url: URL): string {
  const copy = new URL(url);
  copy.hash = "";
  for (const key of Array.from(copy.searchParams.keys())) {
    if (/^(utm_|from$|share_|timestamp$|fbclid$|gclid$)/i.test(key)) copy.searchParams.delete(key);
  }
  if (platformOf(copy) === "x") {
    const id = copy.pathname.match(/\/status\/(\d+)/)?.[1];
    if (id) return `https://x.com/i/status/${id}`;
  }
  return copy.toString();
}
