import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/*
 * gastario-supplier-portal-credentials-20260802
 *
 * AES-256-GCM fuer Lieferantenportal-Zugangsdaten.
 * Der Schluessel liegt ausschliesslich in Railway.
 */

export type SupplierPortalCredentials = {
  providerCode: string;
  username: string;
  password: string;
  portalUrl: string;
  savedAt: string;
};

const VERSION = "v1";

function getEncryptionKey() {
  const secret = String(
    process.env.SUPPLIER_PORTAL_ENCRYPTION_KEY ||
      ""
  ).trim();

  if (secret.length < 32) {
    throw new Error(
      "SUPPLIER_PORTAL_ENCRYPTION_KEY fehlt oder ist zu kurz. Bitte zuerst einen starken Railway-Schlüssel mit mindestens 32 Zeichen hinterlegen."
    );
  }

  return createHash("sha256")
    .update(secret, "utf8")
    .digest();
}

export function encryptSupplierPortalCredentials(
  credentials: SupplierPortalCredentials
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const plaintext = Buffer.from(
    JSON.stringify(credentials),
    "utf8"
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  const authenticationTag =
    cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authenticationTag.toString(
      "base64url"
    ),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSupplierPortalCredentials(
  encryptedValue: string
): SupplierPortalCredentials {
  const parts = String(encryptedValue || "")
    .trim()
    .split(".");

  if (
    parts.length !== 4 ||
    parts[0] !== VERSION
  ) {
    throw new Error(
      "Unbekanntes Format der verschlüsselten Lieferantenzugangsdaten."
    );
  }

  const iv = Buffer.from(
    parts[1],
    "base64url"
  );

  const authenticationTag = Buffer.from(
    parts[2],
    "base64url"
  );

  const ciphertext = Buffer.from(
    parts[3],
    "base64url"
  );

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(authenticationTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(decrypted);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !String(parsed.username || "").trim() ||
    !String(parsed.password || "")
  ) {
    throw new Error(
      "Die entschlüsselten Lieferantenzugangsdaten sind unvollständig."
    );
  }

  return parsed as SupplierPortalCredentials;
}

export function createSupplierPortalAccountHint(
  username: string
) {
  const value = String(username || "").trim();

  if (!value) {
    return null;
  }

  const atIndex = value.indexOf("@");

  if (atIndex > 0) {
    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);

    return (
      localPart.slice(0, 2) +
      "***@" +
      domain
    );
  }

  return value.slice(0, 3) + "***";
}
