import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * AES-256-GCM at rest for pasted Check-a-Job text (brief §16: pasted messages
 * may name third parties, so raw text is never logged and is encrypted in
 * the database). The key is derived from CHECK_ENCRYPTION_KEY via scrypt so
 * any passphrase-shaped secret works, not just a raw 32-byte key.
 */
function key(): Buffer {
  const secret = process.env.CHECK_ENCRYPTION_KEY;
  if (!secret) throw new Error("CHECK_ENCRYPTION_KEY is not set");
  return scryptSync(secret, "provenant-job-check", 32);
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decryptText(encoded: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivB64, tagB64, ctB64] = parts as [string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
