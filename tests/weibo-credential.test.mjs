import assert from "node:assert/strict";
import test from "node:test";

const previousKey = process.env.X_CREDENTIAL_ENCRYPTION_KEY;
process.env.X_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
const { encryptWeiboSecret, decryptWeiboSecret } = await import("../src/lib/weibo/credential.ts");

test("Weibo OAuth secrets are encrypted and purpose-bound", () => {
  const encrypted = encryptWeiboSecret("refresh-secret", "refresh");
  assert.equal(decryptWeiboSecret(encrypted, "refresh"), "refresh-secret");
  assert.throws(() => decryptWeiboSecret(encrypted, "access"));
  assert.doesNotMatch(encrypted, /refresh-secret/);
});

test("tampered Weibo credentials are rejected", () => {
  const encrypted = encryptWeiboSecret("access-secret", "access");
  const parts = encrypted.split(".");
  parts[3] = `${parts[3].startsWith("A") ? "B" : "A"}${parts[3].slice(1)}`;
  const tampered = parts.join(".");
  assert.throws(() => decryptWeiboSecret(tampered, "access"));
});

test.after(() => {
  if (previousKey === undefined) delete process.env.X_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.X_CREDENTIAL_ENCRYPTION_KEY = previousKey;
});
