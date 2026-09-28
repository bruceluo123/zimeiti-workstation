// AI 聊天客户端（服务端调用）
// 优先级：请求体传入的 config > 环境变量 DEEPSEEK_API_KEY（兜底）

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL    = "deepseek-flash";

function isDefaultBaseUrl(baseUrl: string | undefined): boolean {
  if (!baseUrl?.trim()) return true;
  return baseUrl.trim().replace(/\/+$/, "").toLowerCase() === DEFAULT_BASE_URL;
}

function isPrivateHostname(rawHostname: string): boolean {
  const hostname = rawHostname.replace(/^\[|\]$/g, "").toLowerCase();
  const isIpv6 = hostname.includes(":");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "::1" ||
    hostname === "::" ||
    (isIpv6 && (
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe8") ||
      hostname.startsWith("fe9") ||
      hostname.startsWith("fea") ||
      hostname.startsWith("feb")
    ))
  ) {
    return true;
  }

  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function chatCompletionsUrl(rawBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawBaseUrl.trim());
  } catch {
    throw new Error("Base URL 格式不正确");
  }

  if (url.username || url.password) throw new Error("Base URL 不能包含账号或密码");
  if (url.search || url.hash) throw new Error("Base URL 不能包含查询参数或锚点");

  const privateHost = isPrivateHostname(url.hostname);
  const localDevelopment = process.env.NODE_ENV !== "production" && privateHost;
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localDevelopment)) {
    throw new Error("Base URL 必须使用 HTTPS；本地开发地址可使用 HTTP");
  }
  if (privateHost && process.env.NODE_ENV === "production") {
    throw new Error("生产环境不能访问本机或内网 AI 地址");
  }

  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = path.endsWith("/chat/completions") ? path : `${path}/chat/completions`;
  return url.toString();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "original" | "auto" } })[];
}

export interface AiCallConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export async function chatComplete(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number; responseFormat?: "json_object" },
  config?: AiCallConfig
): Promise<string> {
  const requestKey = config?.apiKey?.trim() || "";
  const canUseServerKey = isDefaultBaseUrl(config?.baseUrl);
  const key = requestKey || (canUseServerKey ? process.env.DEEPSEEK_API_KEY || "" : "");
  const baseUrl = requestKey ? config?.baseUrl?.trim() || DEFAULT_BASE_URL : DEFAULT_BASE_URL;
  const model   = config?.model?.trim() || DEFAULT_MODEL;

  if (!key) {
    throw new Error(
      canUseServerKey
        ? "未配置 API Key，请在设置页填写"
        : "自定义 Base URL 必须同时填写对应的 API Key"
    );
  }

  const res = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens:  options?.maxTokens  ?? 2000,
      ...(options?.responseFormat ? { response_format: { type: options.responseFormat } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`AI API ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message?.content ?? "";
}

/** 判断是否有可用的 API Key（server-side 或 client 传入） */
export function hasApiKey(config?: AiCallConfig): boolean {
  if (config?.apiKey?.trim()) return true;
  return isDefaultBaseUrl(config?.baseUrl) && !!process.env.DEEPSEEK_API_KEY;
}
