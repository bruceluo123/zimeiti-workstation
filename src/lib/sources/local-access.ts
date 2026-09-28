/** Explicitly opt-in, loopback-only developer service; never enabled on Vercel. */
export function localCaptureAllowed(request: { url: string; headers: Headers }): boolean {
  if (process.env.VERCEL || process.env.ZMT_LOCAL_CAPTURE_ENABLED !== "true") return false;
  const host = request.headers.get("host") ?? "";
  if (!["localhost:3002", "127.0.0.1:3002"].includes(host)) return false;
  const origin = request.headers.get("origin");
  // Next middleware can normalize request.url to localhost even when the browser
  // requested 127.0.0.1. Compare with the allowlisted HTTP Host, never a proxy header.
  if (origin && origin !== `http://${host}`) return false;
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

/** Allow selected paid development APIs only from this machine's own UI. */
export function localDevelopmentApiAllowed(request: { url: string; headers: Headers }): boolean {
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED === "true") return false;
  const host = request.headers.get("host") ?? "";
  if (!["localhost:3002", "127.0.0.1:3002"].includes(host)) return false;
  const origin = request.headers.get("origin");
  if (origin !== `http://${host}`) return false;
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

/** Private local Codex bridge. Reject navigation, cross-site requests and originless mutations. */
export function localAssistantAllowed(request: { url: string; headers: Headers; method: string }): boolean {
  if (!localCaptureAllowed(request) || request.headers.get("sec-fetch-site") !== "same-origin") return false;
  return request.method === "GET" || request.headers.get("origin") === `http://${request.headers.get("host")}`;
}

/** Read-only local knowledge UI. Production requires the explicit local launcher opt-in. */
export function localKnowledgeReadAllowed(request: { url: string; headers: Headers; method: string }): boolean {
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_ZMT_AUTH_REQUIRED === "true") return false;
  if (process.env.NODE_ENV !== "development" && process.env.ZMT_LOCAL_CAPTURE_ENABLED !== "true") return false;
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url).pathname;
  if (!["/knowledge", "/api/kb", "/api/kb/doc"].includes(pathname)) return false;
  const host = request.headers.get("host") ?? "";
  if (!["localhost:3002", "127.0.0.1:3002"].includes(host)) return false;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost && forwardedHost !== host) return false;
  if (forwardedProto && forwardedProto !== "http") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${host}`) return false;
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}
