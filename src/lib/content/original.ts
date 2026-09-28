export const DEFAULT_WEIBO_UID = "7331277089";

export function parseOwnXUrl(value: string): { url: string; externalId: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/Global_Funny_\/status\/(\d+)(?:\/.*)?$/i);
    if (!match) return null;
    return { url: `https://x.com/Global_Funny_/status/${match[1]}`, externalId: match[1] };
  } catch {
    return null;
  }
}

export function parseWeiboPostUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !["weibo.com", "www.weibo.com", "m.weibo.cn"].includes(host)) return null;
    const isPost = host === "m.weibo.cn"
      ? /^\/(?:status|detail)\/[A-Za-z0-9]+\/?$/.test(url.pathname)
      : /^\/(?:7331277089\/[A-Za-z0-9]+|detail\/[A-Za-z0-9]+)\/?$/.test(url.pathname);
    if (!isPost) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
