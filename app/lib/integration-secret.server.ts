import crypto from "node:crypto";

function getEncryptionKey() {
  const keyValue = process.env.IMAP_ENCRYPTION_KEY || "";

  if (!keyValue) {
    throw new Error("Verschlüsselungsschlüssel fehlt in Railway.");
  }

  const key = Buffer.from(keyValue, "base64");

  if (key.length !== 32) {
    throw new Error(
      "Der Verschlüsselungsschlüssel muss 32 Byte lang sein."
    );
  }

  return key;
}

export function encryptIntegrationSecret(value: string) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new Error("Es wurde kein Zugangsschlüssel übergeben.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(normalizedValue, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptIntegrationSecret(value: string) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new Error("Es ist kein gespeicherter Zugangsschlüssel vorhanden.");
  }

  const parts = normalizedValue.split(".");

  if (parts.length !== 3) {
    throw new Error("Der gespeicherte Zugangsschlüssel ist ungültig.");
  }

  const [ivValue, tagValue, encryptedValue] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivValue, "base64");
  const tag = Buffer.from(tagValue, "base64");
  const encrypted = Buffer.from(encryptedValue, "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function maskIntegrationSecret(
  value?: string | null
) {
  return value
    ? "Zugangsschlüssel gespeichert"
    : "Noch kein Zugangsschlüssel gespeichert";
}