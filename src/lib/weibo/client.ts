const APP_BASE = "https://open.weibo.com/cli/api";
const CLIENT_ID = "weibo-cli";

export class WeiboCliError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (response.ok) return data;
  const nested = typeof data.error === "object" && data.error ? data.error as Record<string, unknown> : null;
  const code = typeof data.error === "string" ? data.error : typeof nested?.code === "string" ? nested.code : "WEIBO_API_ERROR";
  const message = typeof data.error_description === "string" ? data.error_description
    : typeof nested?.message === "string" ? nested.message
    : response.status === 401 ? "微博授权已失效，请重新连接"
    : response.status === 402 ? "微博 Credits 余额不足"
    : response.status === 429 ? "微博写入频率受限，请稍后重试"
    : "微博开放平台暂时无法完成请求";
  throw new WeiboCliError(response.status, code, message);
}

async function post(path: string, body: unknown, token?: string) {
  try {
    const response = await fetch(`${APP_BASE}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "maimanfen-workstation/1.0",
        "X-Weibo-Agent-Source": "codex",
        "X-Weibo-Agent-Host": "web",
        "X-Weibo-Source-Method": "automation",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    return readJson(response);
  } catch (cause) {
    if (cause instanceof WeiboCliError) throw cause;
    throw new WeiboCliError(0, "NETWORK_ERROR", "无法确认微博是否已收到发布请求，已暂停该条以避免重复发布");
  }
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export async function startWeiboDeviceAuthorization(): Promise<DeviceAuthorization> {
  const data = await post("/oauth/device/code", { client_id: CLIENT_ID, device_name: "麦满分工作站" });
  const deviceCode = String(data.device_code || "");
  const userCode = String(data.user_code || "");
  const verificationUri = String(data.verification_uri || "");
  if (!deviceCode || !userCode || !verificationUri.startsWith("https://open.weibo.com/")) throw new Error("微博授权入口返回格式异常");
  const url = new URL(verificationUri);
  url.searchParams.set("user_code", userCode);
  return {
    deviceCode, userCode, verificationUri, verificationUrl: url.toString(),
    expiresIn: Number(data.expires_in) || 600,
    interval: Math.min(30, Math.max(1, Number(data.interval) || 5)),
  };
}

export interface WeiboTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

function normalizeTokens(data: Record<string, unknown>): WeiboTokens {
  const accessToken = String(data.access_token || "");
  const refreshToken = String(data.refresh_token || "");
  if (!accessToken || !refreshToken) throw new Error("微博没有返回可续期的授权凭据");
  return {
    accessToken, refreshToken,
    expiresIn: Math.max(60, Number(data.expires_in) || 3600),
    refreshExpiresIn: Math.max(3600, Number(data.refresh_expires_in) || 30 * 24 * 3600),
  };
}

export async function pollWeiboDeviceAuthorization(deviceCode: string): Promise<WeiboTokens> {
  return normalizeTokens(await post("/oauth/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
    client_id: CLIENT_ID,
  }));
}

export async function refreshWeiboTokens(refreshToken: string): Promise<WeiboTokens> {
  return normalizeTokens(await post("/oauth/token", {
    grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLIENT_ID,
  }));
}

export async function getWeiboUser(accessToken: string): Promise<{ userId: string; username: string }> {
  const response = await fetch(`${APP_BASE}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  const data = await readJson(response);
  const userId = String(data.user_id || "");
  const username = String(data.username || "");
  if (!/^[0-9]{5,20}$/.test(userId) || !username) throw new Error("微博账号信息返回格式异常");
  return { userId, username };
}

export async function publishWeiboText(accessToken: string, body: string, aiGenerated: boolean) {
  const args: Record<string, string | number> = { status: body };
  if (aiGenerated) args.is_ai_generated = 1;
  const payload = await post("/cli/invoke", { group: "statuses", action: "update", args }, accessToken);
  const result = (payload.result && typeof payload.result === "object" ? payload.result : payload) as Record<string, unknown>;
  const id = String(result.idstr || result.id || "");
  const slug = String(result.mblogid || result.bid || id);
  if (!id) throw new Error("微博已接受发布，但没有返回帖子 ID；请到微博确认后再处理队列");
  return { id, urlSlug: slug };
}
