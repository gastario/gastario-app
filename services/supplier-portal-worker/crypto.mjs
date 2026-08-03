import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";

function getEncryptionKey() {
  const secret = String(
    process.env.SUPPLIER_PORTAL_ENCRYPTION_KEY ||
      ""
  ).trim();

  if (secret.length < 32) {
    throw new Error(
      "SUPPLIER_PORTAL_ENCRYPTION_KEY fehlt oder ist zu kurz."
    );
  }

  return createHash("sha256")
    .update(secret, "utf8")
    .digest();
}

export function encryptJson(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(
      Buffer.from(JSON.stringify(value), "utf8")
    ),
    cipher.final(),
  ]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptJson(encryptedValue) {
  const parts = String(encryptedValue || "")
    .trim()
    .split(".");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(
      "Unbekanntes Verschlüsselungsformat."
    );
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(parts[1], "base64url")
  );

  decipher.setAuthTag(
    Buffer.from(parts[2], "base64url")
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(parts[3], "base64url")
    ),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted);
}
