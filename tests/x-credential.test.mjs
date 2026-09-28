import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { credentialReady, decryptToken, encryptToken } from "../src/lib/x/credential.ts";

const previousKey = process.env.X_CREDENTIAL_ENCRYPTION_KEY;
afterEach(() => {
  if (previousKey === undefined) delete process.env.X_CREDENTIAL_ENCRYPTION_KEY;
  else process.env.X_CREDENTIAL_ENCRYPTION_KEY = previousKey;
});

test("X token is encrypted and tamper-resistant", () => {
  process.env.X_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  assert.equal(credentialReady(), true);
  const ciphertext = encryptToken("sample-secret-token");
  assert.equal(ciphertext.includes("sample-secret-token"), false);
  assert.equal(decryptToken(ciphertext), "sample-secret-token");
  const parts = ciphertext.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptToken(parts.join(".")));
});

test("missing encryption key blocks credential storage", () => {
  delete process.env.X_CREDENTIAL_ENCRYPTION_KEY;
  assert.equal(credentialReady(), false);
  assert.throws(() => encryptToken("sample-secret-token"));
});
