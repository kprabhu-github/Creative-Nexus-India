// AES-256-GCM encryption for email app passwords.
// Key comes from EMAIL_ENCRYPTION_KEY env var (32 bytes hex).
// Each ciphertext is stored as `iv:authTag:ciphertext` in base64.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "EMAIL_ENCRYPTION_KEY env var is missing. Generate with: openssl rand -hex 32",
    );
  }
  if (hex.length !== 64) {
    throw new Error("EMAIL_ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LEN) throw new Error("Bad IV length");
  if (tag.length !== TAG_LEN) throw new Error("Bad auth tag length");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
