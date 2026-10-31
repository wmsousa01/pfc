import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Tokens OAuth cifrados em repouso (social_connections), AES-256-GCM.
 * Chave em SOCIAL_TOKEN_KEY: 32 bytes em base64 (`openssl rand -base64 32`).
 * Lida só no uso, para o build não quebrar sem a variável.
 *
 * Formato (base64, separado por ':'): iv:authTag:ciphertext — o mesmo do Contenta.
 */
let _key: Buffer | null = null;

function key(): Buffer {
  if (!_key) {
    const raw = process.env.SOCIAL_TOKEN_KEY;
    if (!raw) throw new Error("SOCIAL_TOKEN_KEY ausente (gere com: openssl rand -base64 32).");
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error(`SOCIAL_TOKEN_KEY precisa ter 32 bytes (tem ${buf.length}).`);
    _key = buf;
  }
  return _key;
}

export function isCryptoConfigured(): boolean {
  return !!process.env.SOCIAL_TOKEN_KEY;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(":");
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(":");
  if (!iv || !tag || !data) throw new Error("Token cifrado malformado.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
