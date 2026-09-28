import { createHash } from "node:crypto";

export function automationSecret(): string {
  const source = process.env.X_CREDENTIAL_ENCRYPTION_KEY;
  if (!source) throw new Error("自动任务密钥尚未配置");
  return createHash("sha256").update(`zmt-automation:${source}`, "utf8").digest("hex");
}

export function cronAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET || automationSecret();
  return request.headers.get("authorization") === `Bearer ${expected}`;
}
