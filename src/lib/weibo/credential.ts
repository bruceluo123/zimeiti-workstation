import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function weiboKey(): Buffer {
  const encoded = process.env.X_CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error("微博凭据加密密钥尚未配置");
  const source = Buffer.from(encoded, "base64");
  if (source.length !== 32 || source.toString("base64") !== encoded) throw new Error("微博凭据加密密钥格式无效");
  return createHash("sha256").update(source).update("weibo-cli-v1").digest();
}

export function encryptWeiboSecret(value: string, purpose: "access" | "refresh" | "device"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", weiboKey(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", purpose, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptWeiboSecret(value: string, purpose: "access" | "refresh" | "device"): string {
  const [version, storedPurpose, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || storedPurpose !== purpose || !iv || !tag || !encrypted || extra) throw new Error("微博连接凭据格式无效");
  const decipher = createDecipheriv("aes-256-gcm", weiboKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
