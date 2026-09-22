import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Social platform access tokens are the most sensitive data this app holds
// (PRD section 7: "token disimpan terenkripsi"). We encrypt them with
// AES-256-GCM before writing to SocialAccount.accessTokenCipher, using a key
// that lives only in the deployment's environment variables (Vercel env /
// secret manager) — never in the database or source control.

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded).",
    );
  }
  return key;
}

// Stored format: base64(iv) . base64(authTag) . base64(ciphertext)
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptToken(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted token payload.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
